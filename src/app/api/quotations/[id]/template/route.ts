import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Copy a quotation's format (title, items, terms) into a reusable template.
 *  Customer details and dates stay on the quotation — a template is the
 *  format you fill in next time. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quotation) return NextResponse.json({ error: "Quotation not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give this template a name." }, { status: 400 });

  const template = await prisma.quotationTemplate.create({
    data: {
      name,
      title: quotation.title,
      notes: quotation.notes,
      terms: quotation.terms,
      reminder: quotation.reminder,
      paymentDueDays: quotation.paymentDueDays,
      language: quotation.language,
      taxRate: quotation.taxRate,
      discount: quotation.discount,
      repeatCount: quotation.repeatCount,
      items: {
        create: quotation.items.map((item) => ({
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
  });

  return NextResponse.json({ id: template.id, name: template.name }, { status: 201 });
}
