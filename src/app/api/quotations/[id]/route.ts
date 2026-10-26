import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/calculations";
import { customerFieldsFrom, itemCreateFrom, documentDefaultsFrom, documentLanguageFrom, withParsedItems, VALID_QUOTATION_STATUSES } from "@/lib/document-helpers";
import { logActivity } from "@/lib/activity";
import { quotationShareFieldsFrom } from "@/lib/quotationShares";
import { quotationCanModify, quotationVisible } from "@/lib/documentAccess";
import { bindShareColleagueNames } from "@/lib/quotationAuthor";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationVisible(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      shares: { orderBy: { sortOrder: "asc" } },
      invoice: { select: { id: true, number: true } },
    },
  });

  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  return NextResponse.json(withParsedItems(quotation));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();

  if (!(await quotationCanModify(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const existing = await prisma.quotation.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  if (body.status !== undefined && !VALID_QUOTATION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid quotation status." }, { status: 400 });
  }
  if (body.sharesOnly || (existing.status === "CONVERTED" && body.items === undefined)) {
    if (body.shares === undefined) {
      return NextResponse.json(
        { error: "This quotation has been converted to an invoice and can no longer be edited." },
        { status: 409 }
      );
    }
    const sharing = quotationShareFieldsFrom(body);
    if (sharing.error) {
      return NextResponse.json({ error: sharing.error }, { status: 400 });
    }
    const boundShares = await bindShareColleagueNames(sharing.shares);
    const quotation = await prisma.$transaction(async (tx) => {
      await tx.quotationShare.deleteMany({ where: { quotationId: params.id } });
      return tx.quotation.update({
        where: { id: params.id },
        data: {
          preparedBy: sharing.preparedBy,
          shareMode: sharing.shareMode,
          shares: { create: boundShares },
        },
        include: { shares: { orderBy: { sortOrder: "asc" } } },
      });
    });
    await logActivity({
      documentType: "quotation",
      documentId: quotation.id,
      type: "EDITED",
      description: "Colleague split updated",
    });
    return NextResponse.json(quotation);
  }

  // Status-only update (e.g. marking as SENT/ACCEPTED/REJECTED) does not require items.
  if (body.items === undefined) {
    const quotation = await prisma.quotation.update({
      where: { id: params.id },
      data: {
        status: body.status ?? undefined,
        notes: body.notes ?? undefined,
        terms: body.terms ?? undefined,
        reminder: body.reminder ?? undefined,
        language: body.language !== undefined ? documentLanguageFrom(body.language) : undefined,
        paymentDueDays:
          body.paymentDueDays !== undefined ? Number(body.paymentDueDays) : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      },
      include: { items: true, invoice: { select: { id: true, number: true } } },
    });

    const changed: string[] = [];
    if (body.status !== undefined && body.status !== existing.status) {
      changed.push(`status → ${body.status}`);
    }
    if (body.notes !== undefined) changed.push("notes");
    if (body.terms !== undefined) changed.push("terms");
    if (body.reminder !== undefined) changed.push("reminder");
    if (body.language !== undefined) changed.push("language");
    if (body.paymentDueDays !== undefined) changed.push("payment terms");
    if (body.expiryDate) changed.push("expiry date");
    await logActivity({
      documentType: "quotation",
      documentId: quotation.id,
      type: "EDITED",
      description: changed.length ? `Updated: ${changed.join(", ")}` : "Updated",
    });

    return NextResponse.json(withParsedItems(quotation));
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
  const taxRate = Number(body.taxRate) || 0;
  const discount = Number(body.discount) || 0;
  // Whole-document multiplier for work conducted several times (e.g. a
  // training run 3 times) — always a positive whole number, defaulting to
  // 1 (no repeat) for anything invalid.
  const repeatCount = Math.max(1, Math.round(Number(body.repeatCount)) || 1);
  const { subtotal, taxAmount, total } = computeTotals(body.items, taxRate, discount, repeatCount);
  const { paymentDueDays, terms, reminder, language } = documentDefaultsFrom(body);
  const replaceShares = Array.isArray(body.shares);
  const sharing = quotationShareFieldsFrom(body);
  if (sharing.error) {
    return NextResponse.json({ error: sharing.error }, { status: 400 });
  }
  const boundShares = replaceShares ? await bindShareColleagueNames(sharing.shares) : [];

  const quotation = await prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: params.id } });
    if (replaceShares) await tx.quotationShare.deleteMany({ where: { quotationId: params.id } });
    return tx.quotation.update({
      where: { id: params.id },
      data: {
        title: body.title !== undefined ? (body.title || "").trim() : undefined,
        ...customer,
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        status: existing.status === "CONVERTED" ? existing.status : (body.status ?? existing.status),
        notes: body.notes ?? null,
        terms,
        reminder,
        language,
        paymentDueDays,
        repeatCount,
        taxRate,
        discount,
        subtotal,
        taxAmount,
        total,
        preparedBy: body.preparedBy !== undefined ? sharing.preparedBy : undefined,
        shareMode: replaceShares ? sharing.shareMode : undefined,
        items: {
          create: body.items.map(itemCreateFrom),
        },
        shares: replaceShares ? { create: boundShares } : undefined,
      },
      include: {
        items: true,
        shares: { orderBy: { sortOrder: "asc" as const } },
        invoice: { select: { id: true, number: true } },
      },
    });
  });

  await logActivity({
    documentType: "quotation",
    documentId: quotation.id,
    type: "EDITED",
    description: "Details and line items updated",
  });

  return NextResponse.json(withParsedItems(quotation));
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationCanModify(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const existing = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { invoice: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  await logActivity({
    documentType: "quotation",
    documentId: existing.id,
    type: "DELETED",
    description: existing.invoice
      ? `Quotation ${existing.number} deleted, along with its invoice ${existing.invoice.number}`
      : `Quotation ${existing.number} deleted`,
  });

  if (existing.invoice) {
    // A quotation that's been converted has an invoice pointing back at it
    // (Invoice.quotationId) — that row (and its receipt, which cascades
    // automatically off the invoice) has to go first, in the same
    // transaction, or the delete below would violate that foreign key.
    await logActivity({
      documentType: "invoice",
      documentId: existing.invoice.id,
      type: "DELETED",
      description: `Invoice ${existing.invoice.number} deleted along with its source quotation ${existing.number}`,
    });
    await prisma.$transaction([
      prisma.invoice.delete({ where: { id: existing.invoice.id } }),
      prisma.quotation.delete({ where: { id: params.id } }),
    ]);
  } else {
    await prisma.quotation.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ success: true });
}
