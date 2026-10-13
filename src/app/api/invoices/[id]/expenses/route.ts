import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expenseFilesFrom } from "@/lib/expenseFiles";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "Others";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (category === "Others" && !label) {
    return NextResponse.json(
      { error: "Please describe this expense (category is \"Others\")." },
      { status: 400 }
    );
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Please enter a valid amount." }, { status: 400 });
  }

  let documents;
  try {
    documents = expenseFilesFrom(body.documents);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const count = await prisma.invoiceExpense.count({ where: { invoiceId: params.id } });

  const expense = await prisma.invoiceExpense.create({
    data: {
      invoiceId: params.id,
      category,
      label: category === "Others" ? label : "",
      amount,
      sortOrder: count,
      documents: documents.length
        ? { create: documents.map((file) => ({ fileName: file.fileName, mimeType: file.mimeType, data: file.data })) }
        : undefined,
    },
    include: { documents: { select: { id: true, fileName: true, mimeType: true, createdAt: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
