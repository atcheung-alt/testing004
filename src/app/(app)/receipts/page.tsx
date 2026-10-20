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
import StickyListHeader from "@/components/StickyListHeader";
import { getT } from "@/lib/i18n/server";
import { isValidEmail, receiptEmailContent } from "@/lib/settings";
import { COMPANY } from "@/lib/company";

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

  const receipts =
    view === "expenses"
      ? []
      : await prisma.receipt.findMany({
          where: {
            issueDate: range,
            invoice: customerFilter,
          },
          include: {
            invoice: { select: { id: true, number: true, title: true, customerName: true, customerEmail: true, total: true } },
          },
          orderBy: { issueDate: "desc" },
        });

  const expenses =
    view === "receipts"
      ? []
      : await prisma.invoiceExpense.findMany({
          where: {
            createdAt: range,
            invoice: customerFilter,
          },
          include: {
            invoice: { select: { id: true, number: true, title: true, customerName: true, customerEmail: true } },
            documents: { select: { id: true }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        });

  const receiptTotal = receipts.reduce((sum, receipt) => sum + (receipt.invoice?.total || 0), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);

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
    ...receipts.map((receipt) => ({
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
    ...expenses.map((expense) => ({
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
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title={view === "expenses" ? t("No expenses found") : t("No receipts found")}
        description={
          view === "expenses"
            ? t("Try another date range, or record an expense from the Expenses page.")
            : t("Try adjusting your filters. Receipts are generated automatically once an invoice is verified as Paid.")
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {view !== "expenses" && (
          <div className="card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Receipts")}</p>
            <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(receiptTotal)}</p>
          </div>
        )}
        {view !== "receipts" && (
          <div className="card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Expenses")}</p>
            <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(expenseTotal)}</p>
          </div>
        )}
        {view === "all" && (
          <div className="card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Net")}</p>
            <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(receiptTotal - expenseTotal)}</p>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[46rem] divide-y divide-line">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between px-4 sm:px-5 py-4 gap-6">
            <Link href={row.href} className="min-w-[18rem] hover:opacity-80">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                    row.kind === "receipt" ? "bg-accent-100 text-accent-600" : "bg-danger-50 text-danger-500"
                  }`}
                >
                  {row.kind === "receipt" ? t("Receipt") : t("Expense")}
                </span>
                <span className="font-mono text-sm font-medium whitespace-nowrap">{row.title}</span>
              </div>
              <p className="text-xs text-ink-muted whitespace-nowrap mt-0.5">{row.subtitle}</p>
            </Link>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-sm font-medium">{formatCurrency(row.amount)}</span>
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
    { id: "all", label: t("Consolidated") },
  ];

  return (
    <div>
      <StickyListHeader>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Receipts")}</h1>
          <p className="lead">
            {t("Look at receipts, expenses, or the consolidated record for the dates you choose.")}
          </p>
        </div>
        <a href={exportHref} className="btn-secondary shrink-0">
          <Download size={15} /> {t("Export CSV")}
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <Link
            key={item.id}
            href={viewHref(item.id)}
            className={item.id === view ? "btn-primary" : "btn-secondary"}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <SearchBox placeholder="Search by customer…" />
        <DateRangeFilter />
      </div>
      </StickyListHeader>

      <Suspense fallback={<div className="text-sm text-ink-muted">{t("Loading…")}</div>}>
        <MoneyList view={view} q={searchParams.q} from={searchParams.from} to={searchParams.to} />
      </Suspense>
    </div>
  );
}
