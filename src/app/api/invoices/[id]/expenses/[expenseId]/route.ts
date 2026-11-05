import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceCanModify } from "@/lib/documentAccess";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";
import { ensureInvoiceExpenseOwnerColumn } from "@/lib/generalExpense";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  if (!(await invoiceCanModify(params.id))) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: "Sign in to delete an expense." }, { status: 401 });
  await ensureInvoiceExpenseOwnerColumn();
  const expense = await prisma.invoiceExpense.findUnique({ where: { id: params.expenseId } });
  if (!expense || expense.invoiceId !== params.id) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }
  if (!session.isAdmin && !isSuperAdmin(session) && expense.createdBy !== session.userId) {
    return NextResponse.json({ error: "Only the person who saved this expense, or an admin, can delete it." }, { status: 403 });
  }

  await prisma.invoiceExpense.delete({ where: { id: params.expenseId } });
  return NextResponse.json({ success: true });
}
