import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceCanModify } from "@/lib/documentAccess";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  if (!(await invoiceCanModify(params.id))) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }
  const expense = await prisma.invoiceExpense.findUnique({ where: { id: params.expenseId } });
  if (!expense || expense.invoiceId !== params.id) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  await prisma.invoiceExpense.delete({ where: { id: params.expenseId } });
  return NextResponse.json({ success: true });
}
