import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expenseFilesFrom, MAX_EXPENSE_FILES } from "@/lib/expenseFiles";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  const expense = await prisma.invoiceExpense.findUnique({
    where: { id: params.expenseId },
    include: { _count: { select: { documents: true } } },
  });
  if (!expense || expense.invoiceId !== params.id) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  let documents;
  try {
    documents = expenseFilesFrom(body.documents);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (documents.length === 0) {
    return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });
  }
  if (expense._count.documents + documents.length > MAX_EXPENSE_FILES) {
    return NextResponse.json(
      { error: `You can attach up to ${MAX_EXPENSE_FILES} files to one expense.` },
      { status: 400 }
    );
  }

  await prisma.expenseDocument.createMany({
    data: documents.map((file) => ({
      expenseId: expense.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      data: file.data,
    })),
  });

  const saved = await prisma.expenseDocument.findMany({
    where: { expenseId: expense.id },
    select: { id: true, fileName: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(saved, { status: 201 });
}
