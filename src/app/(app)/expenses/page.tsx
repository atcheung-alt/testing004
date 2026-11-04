import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus } from "@/lib/invoiceStatus";
import ExpenseWorkspace from "@/components/ExpenseWorkspace";
import GeneralExpenses from "@/components/GeneralExpenses";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";
import { ensureDefaultExpenseCategories } from "@/lib/ensureExpenseCategories";
import { currentInvoiceFilter } from "@/lib/documentAccess";
import { listGeneralExpenses } from "@/lib/generalExpense";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { invoice?: string };
}) {
  const t = getT();
  await ensureDefaultExpenseCategories();
  const invoiceFilter = await currentInvoiceFilter();
  const [invoices, categories, expenses, general] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceFilter || undefined,
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
      where: invoiceFilter ? { invoice: invoiceFilter } : undefined,
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
    listGeneralExpenses(),
  ]);
  const history = [
    ...general.map((expense) => ({
      id: expense.id,
      source: "general" as const,
      name: expense.name,
      category: expense.category,
      amount: expense.amount,
      date: expense.spentAt.toISOString().slice(0, 10),
      vendor: expense.vendor,
      link: expense.invoiceNumber || "General",
      receiptHref: expense.fileName ? `/api/general-expenses/${expense.id}` : "",
    })),
    ...expenses.map((expense) => ({
      id: expense.id,
      source: "invoice" as const,
      name: expense.label || expense.category,
      category: expense.category,
      amount: expense.amount,
      date: expense.createdAt.toISOString().slice(0, 10),
      vendor: expense.invoice.customerName,
      link: expense.invoice.number,
      receiptHref: expense.documents[0]
        ? `/api/invoices/${expense.invoice.id}/expenses/${expense.id}/documents/${expense.documents[0].id}`
        : "",
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <PageBar title={t("Expenses")} note={t("Record a cost on an invoice, or a general expense that is not tied to one.")} />
      <GeneralExpenses
        invoices={invoices.filter((invoice) => invoice.status !== "CANCELLED").map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          total: invoice.total,
        }))}
        history={history}
      />
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
