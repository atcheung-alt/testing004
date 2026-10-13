import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemCreateFrom, documentDefaultsFrom } from "@/lib/document-helpers";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Give this template a name." }, { status: 400 });
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "At least one line item is required." }, { status: 400 });
  }
  for (const item of body.items) {
    if (!item?.name || !String(item.name).trim()) {
      return NextResponse.json({ error: "Every line item needs a name." }, { status: 400 });
    }
  }

  const { paymentDueDays, terms, reminder, language } = documentDefaultsFrom(body);
  const repeatCount = Math.max(1, Math.round(Number(body.repeatCount)) || 1);

  const template = await prisma.$transaction(async (tx) => {
    await tx.quotationTemplateItem.deleteMany({ where: { templateId: params.id } });
    return tx.quotationTemplate.update({
      where: { id: params.id },
      data: {
        name,
        title: typeof body.title === "string" ? body.title.trim() : "",
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes : null,
        terms,
        reminder,
        paymentDueDays,
        language,
        taxRate: Number(body.taxRate) || 0,
        discount: Number(body.discount) || 0,
        repeatCount,
        items: { create: body.items.map(itemCreateFrom) },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json(template);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.quotationTemplate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  await prisma.quotationTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
