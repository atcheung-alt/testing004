import { prisma } from "@/lib/prisma";
import GeneralExpenses from "@/components/GeneralExpenses";
import { currentInvoiceFilter } from "@/lib/documentAccess";
import { ensureGeneralExpenseTable, ensureInvoiceExpenseOwnerColumn, listGeneralExpenseReceipts, listGeneralExpenses } from "@/lib/generalExpense";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";
import { formatDate } from "@/lib/calculations";
import { loadClientSources } from "@/lib/clientSource";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await getCurrentUser();
  const admin = Boolean(session && (session.isAdmin || isSuperAdmin(session)));
  await Promise.all([ensureGeneralExpenseTable().catch(() => undefined), ensureInvoiceExpenseOwnerColumn().catch(() => undefined)]);
  const invoiceFilter = await currentInvoiceFilter();
  const [invoices, expenses, general] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceFilter || undefined,
      select: {
        id: true,
        number: true,
        customerName: true,
        customerContact: true,
        customerEmail: true,
        customerPhone: true,
        title: true,
        poNumber: true,
        issueDate: true,
        total: true,
        status: true,
        items: { select: { name: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { issueDate: "desc" },
      take: 400,
    }),
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
  const sources = await loadClientSources(invoices.map((invoice) => invoice.id));
  const extraReceipts = await listGeneralExpenseReceipts(general.map((expense) => expense.id));
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
      invoiceId: invoices.find((invoice) => invoice.number === expense.invoiceNumber)?.id || "",
      receiptHref: expense.fileName ? `/api/general-expenses/${expense.id}` : "",
      receipts: [
        ...(expense.fileName ? [{ href: `/api/general-expenses/${expense.id}`, name: expense.fileName }] : []),
        ...(extraReceipts.get(expense.id) || []).map((file) => ({
          href: `/api/general-expenses/${expense.id}/receipts/${file.id}`,
          name: file.fileName,
        })),
      ],
      canDelete: admin || Boolean(session && expense.createdBy === session.userId),
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
      invoiceId: expense.invoice.id,
      receiptHref: expense.documents[0]
        ? `/api/invoices/${expense.invoice.id}/expenses/${expense.id}/documents/${expense.documents[0].id}`
        : "",
      receipts: expense.documents.map((file) => ({
        href: `/api/invoices/${expense.invoice.id}/expenses/${expense.id}/documents/${file.id}`,
        name: file.fileName,
      })),
      canDelete: admin || Boolean(session && expense.createdBy === session.userId),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <GeneralExpenses
        invoices={invoices.filter((invoice) => invoice.status !== "CANCELLED").map((invoice) => ({
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          customerContact: invoice.customerContact || "",
          customerEmail: invoice.customerEmail || "",
          customerPhone: invoice.customerPhone || "",
          title: invoice.title || "",
          poNumber: invoice.poNumber || "",
          detail: [
            `Issued ${formatDate(invoice.issueDate)}`,
            sources.get(invoice.id) || "",
            invoice.items.map((item) => item.name).filter(Boolean).join(", "),
          ].filter(Boolean).join(" · "),
          total: invoice.total,
        }))}
        history={history}
    />
  );
}
