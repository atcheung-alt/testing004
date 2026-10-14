import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTotals } from "@/lib/calculations";
import { nextDocumentNumber } from "@/lib/numbering";
import { customerFieldsFrom, itemCreateFrom, documentDefaultsFrom, withParsedItems, VALID_QUOTATION_STATUSES } from "@/lib/document-helpers";
import { generateSigningToken } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { companyWhere, ownerCompanyId } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");

  const quotations = await prisma.quotation.findMany({
    where: { status: status || undefined, ...(await companyWhere()) },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: { select: { id: true, number: true } },
    },
  });

  return NextResponse.json(quotations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const customer = customerFieldsFrom(body);
  if (!customer.customerName) {
    return NextResponse.json({ error: "A customer name is required." }, { status: 400 });
  }
  if (body.status !== undefined && !VALID_QUOTATION_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid quotation status." }, { status: 400 });
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
  const number = await nextDocumentNumber("quotation");

  const quotation = await prisma.quotation.create({
    data: {
      number,
      companyId: await ownerCompanyId(),
      title: (body.title || "").trim(),
      ...customer,
      issueDate: body.issueDate ? new Date(body.issueDate) : new Date(),
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      status: body.status || "DRAFT",
      notes: body.notes || null,
      terms,
      reminder,
      paymentDueDays,
      language,
      signingToken: generateSigningToken(),
      repeatCount,
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
    documentType: "quotation",
    documentId: quotation.id,
    type: "CREATED",
    description: `Quotation ${quotation.number} created`,
  });

  return NextResponse.json(withParsedItems(quotation), { status: 201 });
}
