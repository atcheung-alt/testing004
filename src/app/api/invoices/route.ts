import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/calculations";
import { nextDocumentNumber } from "@/lib/numbering";
import { customerFieldsFrom, itemCreateFrom, documentDefaultsFrom, eventFieldsFrom, computeDueDate, withParsedItems, VALID_INVOICE_STATUSES } from "@/lib/document-helpers";
import { logActivity } from "@/lib/activity";
import { syncInvoiceCalendarEvent } from "@/lib/events";
import { andFilters, currentInvoiceFilter } from "@/lib/documentAccess";
import { commissionSplitError, commissionSplitRequested, saveInvoiceCommissionSplit } from "@/lib/invoiceCommission";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");

  const invoices = await prisma.invoice.findMany({
    where: andFilters({ status: status || undefined }, await currentInvoiceFilter()),
    orderBy: { createdAt: "desc" },
    include: {
      quotation: { select: { id: true, number: true } },
    },
  });

  return NextResponse.json(invoices);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const customer = customerFieldsFrom(body);
  if (!customer.customerName) {
    return NextResponse.json({ error: "A customer name is required." }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_INVOICE_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid invoice status." }, { status: 400 });
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
  if (commissionSplitRequested(body)) {
    const splitProblem = commissionSplitError(body);
    if (splitProblem) return NextResponse.json({ error: splitProblem }, { status: 400 });
  }

  const taxRate = Number(body.taxRate) || 0;
  const discount = Number(body.discount) || 0;
  const { subtotal, taxAmount, total } = computeTotals(body.items, taxRate, discount);
  const { paymentDueDays, terms, reminder, language } = documentDefaultsFrom(body);
  const number = await nextDocumentNumber("invoice");
  const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();

  const invoice = await prisma.invoice.create({
    data: {
      number,
      title: (body.title || "").trim(),
      poNumber: body.poNumber?.trim() || null,
      ...customer,
      issueDate,
      // Always derived from issue date + payment terms — see computeDueDate.
      dueDate: computeDueDate(issueDate, paymentDueDays),
      eventStartDate: event.eventStartDate,
      eventStartTime: event.eventStartTime,
      eventEndDate: event.eventEndDate,
      eventEndTime: event.eventEndTime,
      status: body.status || "UNPAID",
      paidAt: body.status === "PAID" ? new Date() : null,
      notes: body.notes || null,
      terms,
      reminder,
      language,
      paymentDueDays,
      signatureData: body.signatureData || null,
      signatureName: body.signatureName?.trim() || null,
      signedAt: body.signatureData ? new Date() : null,
      taxRate,
      discount,
      subtotal,
      taxAmount,
      total,
      items: {
        create: body.items.map(itemCreateFrom),
      },
    },
    include: { items: true },
  });

  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "CREATED",
    description: `Invoice ${invoice.number} created`,
  });
  if (commissionSplitRequested(body)) {
    await saveInvoiceCommissionSplit({ ...invoice, quotationId: null, quotation: null }, body);
  }

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

  return NextResponse.json(withParsedItems(invoice), { status: 201 });
}
