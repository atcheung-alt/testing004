import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/calculations";
import { customerFieldsFrom, itemCreateFrom, documentDefaultsFrom, documentLanguageFrom, eventFieldsFrom, computeDueDate, withParsedItems, VALID_INVOICE_STATUSES } from "@/lib/document-helpers";
import { ensureReceiptForInvoice } from "@/lib/receipt";
import { logActivity } from "@/lib/activity";
import { syncInvoiceCalendarEvent } from "@/lib/events";
import { invoiceVisible } from "@/lib/documentAccess";
import { setDocumentViewers } from "@/lib/staffDirectory";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      quotation: { select: { id: true, number: true, driveFileUrl: true } },
      receipt: { select: { id: true, number: true, driveFileUrl: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  return NextResponse.json(withParsedItems(invoice));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  if (Array.isArray(body.viewerEmails)) {
    await setDocumentViewers("invoice", params.id, body.viewerEmails);
  }
  if (body.status !== undefined && !VALID_INVOICE_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid invoice status." }, { status: 400 });
  }

  if (body.items === undefined) {
    const willBecomePaid = body.status === "PAID" && existing.status !== "PAID";
    // Issue date isn't editable on this quick-update path, so the due date
    // only needs recomputing when the payment window itself changes — see
    // computeDueDate. A manual `dueDate` in the body is ignored; it's always
    // derived, never entered directly.
    const newPaymentDueDays = body.paymentDueDays !== undefined ? Number(body.paymentDueDays) : undefined;
    const dueDate = newPaymentDueDays !== undefined ? computeDueDate(existing.issueDate, newPaymentDueDays) : undefined;
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: body.status ?? undefined,
        // Track when the invoice actually became PAID — the basis for
        // monthly revenue/profit. Cleared if it's ever moved off PAID again.
        paidAt: willBecomePaid ? new Date() : body.status !== undefined && body.status !== "PAID" ? null : undefined,
        notes: body.notes ?? undefined,
        terms: body.terms ?? undefined,
        reminder: body.reminder ?? undefined,
        language: body.language !== undefined ? documentLanguageFrom(body.language) : undefined,
        poNumber: body.poNumber !== undefined ? body.poNumber?.trim() || null : undefined,
        paymentDueDays: newPaymentDueDays,
        signatureData: body.signatureData !== undefined ? body.signatureData || null : undefined,
        signatureName:
          body.signatureName !== undefined ? body.signatureName?.trim() || null : undefined,
        signedAt:
          body.signatureData !== undefined
            ? body.signatureData
              ? new Date()
              : null
            : undefined,
        dueDate,
      },
      include: { items: true, quotation: { select: { id: true, number: true } } },
    });

    // Verifying payment (any transition into PAID) auto-generates the
    // receipt and emails it to the client — idempotent, so this is safe even
    // if the status is set to PAID more than once.
    let emailWarning: string | null = null;
    let driveWarning: string | null = null;
    if (existing.status !== "PAID" && invoice.status === "PAID") {
      await logActivity({
        documentType: "invoice",
        documentId: invoice.id,
        type: "PAYMENT_MARKED",
        description: "Marked as Paid (verified by staff)",
      });
      try {
        const result = await ensureReceiptForInvoice(invoice.id);
        emailWarning = result.emailWarning;
        driveWarning = result.driveWarning;
      } catch (err: any) {
        emailWarning = err?.message || "Could not generate the receipt.";
      }
    } else {
      const changed: string[] = [];
      if (body.status !== undefined && body.status !== existing.status) {
        changed.push(`status → ${body.status}`);
      }
      if (body.notes !== undefined) changed.push("notes");
      if (body.terms !== undefined) changed.push("terms");
      if (body.reminder !== undefined) changed.push("reminder");
      if (body.language !== undefined) changed.push("language");
      if (body.poNumber !== undefined) changed.push("PO number");
      // Due date isn't logged separately — it's always derived from the
      // payment terms above, so "payment terms" already covers it.
      if (body.paymentDueDays !== undefined) changed.push("payment terms");
      if (body.signatureData !== undefined) changed.push("signature");
      await logActivity({
        documentType: "invoice",
        documentId: invoice.id,
        type: "EDITED",
        description: changed.length ? `Updated: ${changed.join(", ")}` : "Updated",
      });
    }

    const withReceipt = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        items: true,
        quotation: { select: { id: true, number: true } },
        receipt: { select: { id: true, number: true } },
      },
    });

    return NextResponse.json({ ...withParsedItems(withReceipt!), emailWarning, driveWarning });
  }

  const customer = customerFieldsFrom(body);
  if (!customer.customerName) {
    return NextResponse.json({ error: "A customer name is required." }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
  }
  for (const item of body.items) {
    if (!item.name || !item.name.trim()) {
      return NextResponse.json({ error: "Every line item needs a name." }, { status: 400 });
    }
  }
  const event = eventFieldsFrom(body);
  if (event.error) {
    return NextResponse.json({ error: event.error }, { status: 400 });
  }
  if (body.markOnCalendar === true && (!event.eventStartDate || !event.eventEndDate)) {
    return NextResponse.json(
      { error: "Set both an event start and end date before marking it on the Bookings calendar." },
      { status: 400 }
    );
  }

  const taxRate = Number(body.taxRate) || 0;
  const discount = Number(body.discount) || 0;
  const { subtotal, taxAmount, total } = computeTotals(body.items, taxRate, discount);
  const { paymentDueDays, terms, reminder, language } = documentDefaultsFrom(body);
  const issueDate = body.issueDate ? new Date(body.issueDate) : existing.issueDate;

  const invoice = await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: params.id } });
    return tx.invoice.update({
      where: { id: params.id },
      data: {
        title: body.title !== undefined ? (body.title || "").trim() : undefined,
        poNumber: body.poNumber !== undefined ? body.poNumber?.trim() || null : undefined,
        ...customer,
        issueDate,
        // Always derived from issue date + payment terms — see computeDueDate.
        dueDate: computeDueDate(issueDate, paymentDueDays),
        eventStartDate: event.eventStartDate,
        eventStartTime: event.eventStartTime,
        eventEndDate: event.eventEndDate,
        eventEndTime: event.eventEndTime,
        status: body.status ?? existing.status,
        paidAt:
          body.status === "PAID" && existing.status !== "PAID"
            ? new Date()
            : body.status !== undefined && body.status !== "PAID"
            ? null
            : existing.paidAt,
        notes: body.notes ?? null,
        terms,
        reminder,
        language,
        paymentDueDays,
        signatureData: body.signatureData !== undefined ? body.signatureData || null : existing.signatureData,
        signatureName:
          body.signatureName !== undefined ? body.signatureName?.trim() || null : existing.signatureName,
        signedAt:
          body.signatureData !== undefined
            ? body.signatureData
              ? new Date()
              : null
            : existing.signedAt,
        taxRate,
        discount,
        subtotal,
        taxAmount,
        total,
        items: {
          create: body.items.map(itemCreateFrom),
        },
      },
      include: { items: true, quotation: { select: { id: true, number: true } } },
    });
  });

  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "EDITED",
    description: "Details and line items updated",
  });

  if (typeof body.markOnCalendar === "boolean") {
    const calendarError = await syncInvoiceCalendarEvent({
      mark: body.markOnCalendar,
      invoiceId: invoice.id,
      name: String(body.calendarEventName || invoice.title || invoice.customerName || ""),
      startDate: invoice.eventStartDate,
      startTime: invoice.eventStartTime,
      endDate: invoice.eventEndDate,
      endTime: invoice.eventEndTime,
      contactPerson: invoice.customerContact,
      companyName: invoice.customerName,
    });
    if (calendarError) {
      return NextResponse.json({ error: calendarError }, { status: 400 });
    }
  }

  return NextResponse.json(withParsedItems(invoice));
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  await logActivity({
    documentType: "invoice",
    documentId: existing.id,
    type: "DELETED",
    description: `Invoice ${existing.number} deleted`,
  });

  await prisma.invoice.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
