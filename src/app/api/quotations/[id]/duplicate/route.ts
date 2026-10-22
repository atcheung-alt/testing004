import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering";
import { withParsedItems } from "@/lib/document-helpers";
import { generateSigningToken } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { quotationVisible } from "@/lib/documentAccess";

/**
 * Duplicate a quotation: same customer info and line items, a fresh
 * document number, dates reset to today, and always saved as a new DRAFT —
 * completely independent of the original (no shared signature, comments,
 * signing token, or Drive files).
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationVisible(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const original = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } }, shares: { orderBy: { sortOrder: "asc" } } },
  });

  if (!original) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  const number = await nextDocumentNumber("quotation");
  // Items are copied verbatim (same quantities/prices/multipliers), so the
  // original's stored totals are still correct — no need to recompute them
  // from the raw DB rows (whose `multipliers` column is a JSON string, not
  // the parsed array computeTotals expects; recomputing here would need to
  // parse it right back out for no benefit).

  const duplicate = await prisma.quotation.create({
    data: {
      number,
      title: original.title,
      customerName: original.customerName,
      customerContact: original.customerContact,
      customerEmail: original.customerEmail,
      customerPhone: original.customerPhone,
      customerAddress: original.customerAddress,
      issueDate: new Date(),
      expiryDate: null,
      status: "DRAFT",
      notes: original.notes,
      terms: original.terms,
      reminder: original.reminder,
      language: original.language,
      paymentDueDays: original.paymentDueDays,
      signingToken: generateSigningToken(),
      repeatCount: original.repeatCount,
      taxRate: original.taxRate,
      discount: original.discount,
      subtotal: original.subtotal,
      taxAmount: original.taxAmount,
      total: original.total,
      preparedBy: original.preparedBy,
      shareMode: original.shareMode,
      shares: {
        create: original.shares.map((share) => ({
          colleagueName: share.colleagueName,
          value: share.value,
          sortOrder: share.sortOrder,
        })),
      },
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
    documentType: "quotation",
    documentId: duplicate.id,
    type: "CREATED",
    description: `Duplicated from quotation ${original.number}`,
  });

  return NextResponse.json(withParsedItems(duplicate), { status: 201 });
}
