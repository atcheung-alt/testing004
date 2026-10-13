import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import ExpenseWorkspace from "@/components/ExpenseWorkspace";
import { getT } from "@/lib/i18n/server";
import { ensureDefaultExpenseCategories } from "@/lib/ensureExpenseCategories";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { invoice?: string };
}) {
  const t = getT();
  await ensureDefaultExpenseCategories();
  const [invoices, categories, expenses] = await Promise.all([
    prisma.invoice.findMany({
      select: { id: true, number: true, customerName: true },
      orderBy: { issueDate: "desc" },
      take: 400,
    }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.invoiceExpense.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        invoice: { select: { id: true, number: true, customerName: true } },
        documents: {
          select: { id: true, fileName: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Expenses")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Staff record a cost, choose the related invoice, and keep the receipt with that record.")}
        </p>
      </div>
      <ExpenseWorkspace
        invoices={invoices}
        categories={categories.map((category) => category.name)}
        initialInvoiceId={searchParams.invoice}
        expenses={expenses.map((expense) => ({
          id: expense.id,
          category: expense.category,
          label: expense.label,
          amount: expense.amount,
          createdLabel: formatDate(expense.createdAt),
          invoice: expense.invoice,
          documents: expense.documents,
        }))}
      />
    </div>
  );
}
