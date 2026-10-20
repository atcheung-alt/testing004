import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus } from "@/lib/invoiceStatus";
import ExpenseWorkspace from "@/components/ExpenseWorkspace";
import PageBar from "@/components/PageBar";
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
      select: {
        id: true,
        number: true,
        customerName: true,
        title: true,
        total: true,
        issueDate: true,
        dueDate: true,
        status: true,
        poNumber: true,
      },
      orderBy: { issueDate: "desc" },
      take: 400,
    }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    prisma.invoiceExpense.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        invoice: { select: { id: true, number: true, customerName: true, customerEmail: true } },
        documents: {
          select: { id: true, fileName: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageBar title={t("Expenses")} note={t("Record a cost on an invoice, and keep the receipt with it.")} />
      <ExpenseWorkspace
        invoices={invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          title: invoice.title,
          total: invoice.total,
          issueLabel: formatDate(invoice.issueDate),
          poNumber: invoice.poNumber,
          displayStatus: getInvoiceDisplayStatus(invoice),
        }))}
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
