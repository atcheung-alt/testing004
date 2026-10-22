import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemCreateFrom, documentDefaultsFrom } from "@/lib/document-helpers";
import { logActivity } from "@/lib/activity";
import { andFilters, currentTemplateFilter } from "@/lib/documentAccess";

function templateDataFrom(body: any) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return { error: "Give this template a name." as const };
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { error: "At least one line item is required." as const };
  }
  for (const item of body.items) {
    if (!item?.name || !String(item.name).trim()) {
      return { error: "Every line item needs a name." as const };
    }
  }
  const { paymentDueDays, terms, reminder, language } = documentDefaultsFrom(body);
  const repeatCount = Math.max(1, Math.round(Number(body.repeatCount)) || 1);
  return {
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
      items: {
        create: body.items.map(itemCreateFrom),
      },
    },
  };
}

export async function GET() {
  const templates = await prisma.quotationTemplate.findMany({
    where: andFilters({}, await currentTemplateFilter()),
    orderBy: { updatedAt: "desc" },
    include: { items: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = templateDataFrom(body);
  if ("error" in parsed && parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const template = await prisma.quotationTemplate.create({
    data: parsed.data!,
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  await logActivity({
    documentType: "template",
    documentId: template.id,
    type: "CREATED",
    description: `Template ${template.name} created`,
  });
  return NextResponse.json(template, { status: 201 });
}
