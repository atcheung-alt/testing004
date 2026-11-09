import Link from "next/link";
import { Suspense } from "react";
import { Receipt as ReceiptIcon, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { dateRangeFilter } from "@/lib/dateRange";
import EmptyState from "@/components/EmptyState";
import SearchBox from "@/components/SearchBox";
import DateRangeFilter from "@/components/DateRangeFilter";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import SendEmailButton from "@/components/SendEmailButton";
import DeleteButton from "@/components/DeleteButton";
import { getT } from "@/lib/i18n/server";
import { isValidEmail, receiptEmailContent } from "@/lib/settings";
import { COMPANY } from "@/lib/company";
import { currentInvoiceFilter } from "@/lib/documentAccess";
import { ensureGeneralExpenseTable } from "@/lib/generalExpense";

export const dynamic = "force-dynamic";

type View = "receipts" | "expenses" | "all";

function parseView(value?: string): View {
  if (value === "expenses" || value === "all") return value;
  return "receipts";
}

async function MoneyList({
  view,
  q,
  from,
  to,
}: {
  view: View;
  q?: string;
  from?: string;
  to?: string;
}) {
  const t = getT();
  const range = dateRangeFilter(from, to);
  const customerFilter = q
    ? {
        OR: [
          { customerName: { contains: q, mode: "insensitive" as const } },
          { customerEmail: { contains: q, mode: "insensitive" as const } },
          { number: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  await ensureGeneralExpenseTable().catch(() => undefined);
  const visibility = await currentInvoiceFilter();
  const invoiceWhere =
    customerFilter || visibility
      ? { AND: [...(customerFilter ? [customerFilter] : []), ...(visibility ? [visibility] : [])] }
      : undefined;

  const receipts = await prisma.receipt.findMany({
          where: {
            issueDate: range,
            invoice: invoiceWhere,
          },
          include: {
            invoice: { select: { id: true, number: true, title: true, customerName: true, customerEmail: true, total: true } },
          },
          orderBy: { issueDate: "desc" },
        });

  const invoiceExpenses = await prisma.invoiceExpense.findMany({
          where: {
            createdAt: range,
            invoice: visibility || undefined,
          },
          include: {
            invoice: { select: { id: true, number: true, title: true, customerName: true, customerEmail: true } },
            documents: { select: { id: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        });

  const generalExpenses = await prisma.generalExpense.findMany({
          where: range ? { spentAt: range } : undefined,
          orderBy: { spentAt: "desc" },
          select: {
            id: true,
            name: true,
            amount: true,
            spentAt: true,
            vendor: true,
            invoiceId: true,
            invoiceNumber: true,
          },
        }).catch(() => []);

  const needle = q?.trim().toLowerCase();
  const expenses = invoiceExpenses.filter((expense) => {
    if (!needle) return true;
    return [expense.invoice.customerName, expense.invoice.customerEmail, expense.invoice.number, expense.label, expense.category]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const generals = generalExpenses.filter((expense) => {
    if (!needle) return true;
    return [expense.name, expense.vendor, expense.invoiceNumber].join(" ").toLowerCase().includes(needle);
  });

  const receiptTotal = receipts.reduce((sum, receipt) => sum + (receipt.invoice?.total || 0), 0);
  const expenseTotal =
    invoiceExpenses.reduce((sum, expense) => sum + expense.amount, 0) +
    generalExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  type Row = {
    key: string;
    when: Date;
    kind: "receipt" | "expense";
    href: string;
    title: string;
    subtitle: string;
    amount: number;
    receiptId?: string;
    receiptNumber?: string;
    expenseId?: string;
    invoiceId?: string;
    customerName?: string;
    customerEmail?: string | null;
    emailSubject?: string;
    emailBody?: string;
  };

  const rows: Row[] = [
    ...(view === "expenses" ? [] : receipts).map((receipt) => ({
      key: `receipt-${receipt.id}`,
      when: receipt.issueDate,
      kind: "receipt" as const,
      href: receipt.invoice ? `/invoices/${receipt.invoice.id}` : "#",
      title: receipt.number,
      subtitle: `${receipt.invoice?.customerName || "—"} · ${t("Issued {date}", { date: formatDate(receipt.issueDate) })}`,
      amount: receipt.invoice?.total || 0,
      receiptId: receipt.id,
      receiptNumber: receipt.number,
      customerName: receipt.invoice?.customerName,
      customerEmail: receipt.invoice?.customerEmail,
      emailSubject: receipt.invoice
        ? receiptEmailContent({
            receiptNumber: receipt.number,
            invoiceNumber: receipt.invoice.number,
            title: receipt.invoice.title,
            customerName: receipt.invoice.customerName,
            companyName: COMPANY.shortName || COMPANY.name,
          }).subject
        : "",
      emailBody: receipt.invoice
        ? receiptEmailContent({
            receiptNumber: receipt.number,
            invoiceNumber: receipt.invoice.number,
            title: receipt.invoice.title,
            customerName: receipt.invoice.customerName,
            companyName: COMPANY.shortName || COMPANY.name,
          }).body
        : "",
    })),
    ...(view === "receipts" ? [] : expenses).map((expense) => ({
      key: `expense-${expense.id}`,
      when: expense.createdAt,
      kind: "expense" as const,
      href: `/invoices/${expense.invoice.id}`,
      title: expense.category === "Others" ? expense.label || t("Others") : t(expense.category),
      subtitle: `${expense.invoice.number} · ${expense.invoice.customerName} · ${formatDate(expense.createdAt)}`,
      amount: expense.amount,
      expenseId: expense.id,
      invoiceId: expense.invoice.id,
      customerName: expense.invoice.customerName,
      customerEmail: expense.invoice.customerEmail,
      emailSubject: `Expense for ${expense.invoice.number}`,
      emailBody: `Dear ${expense.invoice.customerName || "Customer"},\n\nPlease find the expense record for invoice ${expense.invoice.number} attached.\n`,
    })),
    ...(view === "receipts" ? [] : generals).map((expense) => {
      const linked = Boolean(expense.invoiceNumber);
      const when = formatDate(expense.spentAt);
      return {
        key: `general-${expense.id}`,
        when: expense.spentAt,
        kind: "expense" as const,
        href: expense.invoiceId ? `/invoices/${expense.invoiceId}` : "/expenses",
        title: expense.name || t("General"),
        subtitle: linked
          ? `${expense.invoiceNumber} · ${expense.vendor || "—"} · ${when}`
          : [when, expense.vendor].filter(Boolean).join(" · "),
        amount: expense.amount,
      };
    }),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  const summary = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="card px-4 py-3">
        <p className="text-sm font-medium text-emerald-600">{t("Receipts")}</p>
        <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(receiptTotal)}</p>
      </div>
      <div className="card px-4 py-3">
        <p className="text-sm font-medium text-rose-600">{t("Expenses")}</p>
        <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(expenseTotal)}</p>
      </div>
      <div className="card px-4 py-3">
        <p className="text-sm font-medium text-ink-muted">{t("Net")}</p>
        <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(receiptTotal - expenseTotal)}</p>
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {summary}
        <EmptyState
          icon={ReceiptIcon}
          title={view === "expenses" ? t("No expenses found") : t("No receipts found")}
          description={
            view === "expenses"
              ? t("Try another date range, or record an expense from the Expenses page.")
              : t("Try adjusting your filters. Receipts are generated automatically once an invoice is verified as Paid.")
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summary}

      <div className="card divide-y divide-line">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-5 gap-3 hover:bg-paper">
            <Link href={row.href} className="min-w-0 hover:opacity-80">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{row.title}</span>
                <span className="stamp border-line text-ink-muted">
                  {row.kind === "receipt" ? t("Receipt") : t("Expense")}
                </span>
              </div>
              <p className="text-xs text-ink-muted truncate mt-0.5">{row.subtitle}</p>
              <p className="text-xs text-ink-faint truncate mt-0.5">&nbsp;</p>
            </Link>
            <div className="flex items-center gap-4 sm:gap-5 shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Amount")}</p>
                <p className="font-mono text-sm font-medium">{formatCurrency(row.amount)}</p>
              </div>
              {row.receiptId && row.receiptNumber && (
                <>
                  <DownloadPdfButton url={`/api/receipts/${row.receiptId}/pdf`} />
                  <SendEmailButton
                    kind="invoices"
                    id={row.receiptId}
                    endpoint={`/api/receipts/${row.receiptId}/email`}
                    defaultTo={row.customerEmail || ""}
                    defaultSubject={row.emailSubject || ""}
                    defaultBody={row.emailBody || ""}
                    emailValid={isValidEmail(row.customerEmail)}
                    showCc
                  />
                  <DeleteButton url={`/api/receipts/${row.receiptId}`} confirmNumber={row.receiptNumber} itemLabel="receipt" />
                </>
              )}
              {row.expenseId && row.invoiceId && (
                <>
                  <DownloadPdfButton url={`/api/invoices/${row.invoiceId}/expenses/${row.expenseId}/pdf`} />
                  <SendEmailButton
                    kind="invoices"
                    id={row.invoiceId}
                    endpoint={`/api/invoices/${row.invoiceId}/expenses/${row.expenseId}/email`}
                    defaultTo={row.customerEmail || ""}
                    defaultSubject={row.emailSubject || ""}
                    defaultBody={row.emailBody || ""}
                    emailValid={isValidEmail(row.customerEmail)}
                    showCc
                  />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReceiptsPage({
  searchParams,
}: {
  searchParams: { q?: string; from?: string; to?: string; view?: string };
}) {
  const t = getT();
  const view = parseView(searchParams.view);
  const exportParams = new URLSearchParams();
  if (searchParams.q) exportParams.set("q", searchParams.q);
  if (searchParams.from) exportParams.set("from", searchParams.from);
  if (searchParams.to) exportParams.set("to", searchParams.to);
  if (view !== "receipts") exportParams.set("view", view);
  const exportHref = `/api/receipts/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  function viewHref(next: View) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (next !== "receipts") params.set("view", next);
    const query = params.toString();
    return query ? `/receipts?${query}` : "/receipts";
  }

  const views: { id: View; label: string }[] = [
    { id: "receipts", label: t("Receipts") },
    { id: "expenses", label: t("Expense") },
    { id: "all", label: t("All") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-filters flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Receipts")}</h1>
          <p className="lead">
            {t("Look at receipts, expenses, or all records for the dates you choose.")}
          </p>
        </div>
        <a href={exportHref} className="btn-secondary shrink-0">
          <Download size={15} /> {t("Export CSV")}
        </a>
      </div>

      <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <Link
            key={item.id}
            href={viewHref(item.id)}
            className={`stamp ${item.id === view ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <SearchBox placeholder="Search by customer…" />
        <DateRangeFilter />
      </div>
      </div>
      </div>

      <Suspense fallback={<div className="text-sm text-ink-muted">{t("Loading…")}</div>}>
        <MoneyList view={view} q={searchParams.q} from={searchParams.from} to={searchParams.to} />
      </Suspense>
    </div>
  );
}
