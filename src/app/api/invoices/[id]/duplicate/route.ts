import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering";
import { withParsedItems, computeDueDate } from "@/lib/document-helpers";
import { logActivity } from "@/lib/activity";
import { invoiceVisible } from "@/lib/documentAccess";

/**
 * Duplicate an invoice: same customer info and line items, a fresh document
 * number, dates reset to today (due date recalculated from today using the
 * same payment window), and always saved as a new DRAFT — completely
 * independent of the original. The duplicate is never linked back to the
 * original's quotation, signature, payment claim, or Drive files, and gets
 * its own public view token once it's actually sent.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const original = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  if (!original) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const number = await nextDocumentNumber("invoice");
  // Items are copied verbatim (same quantities/prices/multipliers), so the
  // original's stored totals are still correct — no need to recompute them
  // from the raw DB rows (whose `multipliers` column is a JSON string, not
  // the parsed array computeTotals expects; recomputing here would need to
  // parse it right back out for no benefit).
  const issueDate = new Date();
  const dueDate = computeDueDate(issueDate, original.paymentDueDays || 30);

  const duplicate = await prisma.invoice.create({
    data: {
      number,
      title: original.title,
      poNumber: null,
      customerName: original.customerName,
      customerContact: original.customerContact,
      customerEmail: original.customerEmail,
      customerPhone: original.customerPhone,
      customerAddress: original.customerAddress,
      quotationId: null,
      issueDate,
      dueDate,
      status: "DRAFT",
      notes: original.notes,
      terms: original.terms,
      reminder: original.reminder,
      language: original.language,
      paymentDueDays: original.paymentDueDays,
      taxRate: original.taxRate,
      discount: original.discount,
      subtotal: original.subtotal,
      taxAmount: original.taxAmount,
      total: original.total,
      items: {
        create: original.items.map((item) => ({
          name: item.name,
          description: item.description,
          imageData: item.imageData,
          unit: item.unit,
          quantity: item.quantity,
          multipliers: item.multipliers,
          unitPrice: item.unitPrice,
          amount: item.amount,
          duration: item.duration,
          fees: item.fees,
          sortOrder: item.sortOrder,
        })),
      },
    },
    include: { items: true },
  });

  await logActivity({
    documentType: "invoice",
    documentId: duplicate.id,
    type: "CREATED",
    description: `Duplicated from invoice ${original.number}`,
  });

  return NextResponse.json(withParsedItems(duplicate), { status: 201 });
}
