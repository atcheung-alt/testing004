import Link from "next/link";
import { Suspense } from "react";
import { Plus, ReceiptText, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus } from "@/lib/invoiceStatus";
import { dateRangeFilter } from "@/lib/dateRange";
import InvoiceStatusToggle from "@/components/InvoiceStatusToggle";
import ScrollRestorer from "@/components/ScrollRestorer";
import EmptyState from "@/components/EmptyState";
import SearchBox from "@/components/SearchBox";
import DateRangeFilter from "@/components/DateRangeFilter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// "OVERDUE" is a computed display status (see src/lib/invoiceStatus.ts), not
// a literal stored one — it's handled as a special case in the query below.
const STATUSES = ["DRAFT", "UNPAID", "PENDING_VERIFICATION", "PAID", "OVERDUE", "CANCELLED"];

async function InvoiceList({
  q,
  status,
  from,
  to,
}: {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const t = getT();
  const invoices = await prisma.invoice.findMany({
    where: {
      status: status === "OVERDUE" ? "UNPAID" : status || undefined,
      dueDate: status === "OVERDUE" ? { lt: new Date() } : undefined,
      issueDate: dateRangeFilter(from, to),
      OR: q
        ? [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: {
      expenses: { select: { amount: true } },
      // Just enough to preview on the list row (see the items line below) —
      // the full set with pricing/fees is only ever needed on the detail
      // page, which fetches its own complete `items` include separately.
      items: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 5 },
    },
  });

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title={t("No invoices found")}
        description={t("Try adjusting your filters, or create a new invoice.")}
        actionHref="/invoices/new"
        actionLabel={t("New invoice")}
      />
    );
  }

  return (
    <div className="card divide-y divide-line">
      {invoices.map((inv) => {
        const revenue = inv.total;
        const expenses = inv.expenses.reduce((sum, e) => sum + e.amount, 0);
        const profit = revenue - expenses;
        return (
          <Link
            key={inv.id}
            href={`/invoices/${inv.id}`}
            className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-5 hover:bg-paper transition-colors gap-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{inv.number}</span>
                <InvoiceStatusToggle id={inv.id} displayStatus={getInvoiceDisplayStatus(inv)} />
              </div>
              <p className="text-xs text-ink-muted truncate mt-0.5">
                {inv.customerName} · {t("Issued {date}", { date: formatDate(inv.issueDate) })}
                {inv.dueDate ? ` · ${t("Due {date}", { date: formatDate(inv.dueDate) })}` : ""}
              </p>
              {/* Always rendered (even blank) so every row reserves the same
                  vertical space regardless of item count — what keeps every
                  row's height consistent, per the design brief. */}
              <p className="text-xs text-ink-faint truncate mt-0.5">
                {inv.items.length > 0 ? inv.items.map((item) => item.name || t("Untitled item")).join(" · ") : " "}
              </p>
            </div>
            <div className="flex items-center gap-4 sm:gap-5 shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Revenue")}</p>
                <p className="font-mono text-sm text-ink">{formatCurrency(revenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Expenses")}</p>
                <p className="font-mono text-sm text-ink-muted">
                  {expenses > 0 ? `−${formatCurrency(expenses)}` : formatCurrency(0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Net profit")}</p>
                <p
                  className={`font-mono text-sm font-medium ${profit < 0 ? "text-danger-500" : "text-brand-600"}`}
                >
                  {formatCurrency(profit)}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; from?: string; to?: string };
}) {
  const t = getT();
  const exportParams = new URLSearchParams();
  if (searchParams.q) exportParams.set("q", searchParams.q);
  if (searchParams.status) exportParams.set("status", searchParams.status);
  if (searchParams.from) exportParams.set("from", searchParams.from);
  if (searchParams.to) exportParams.set("to", searchParams.to);
  const exportHref = `/api/invoices/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  function statusHref(status?: string) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (status) params.set("status", status);
    return `/invoices${params.toString() ? `?${params}` : ""}`;
  }

  // Distinct per filter/search combo, so returning to a different view of
  // this same list doesn't restore some other view's scroll position.
  const restoreKey = statusHref(searchParams.status);

  return (
    <div className="flex flex-col gap-6">
      <ScrollRestorer restoreKey={restoreKey} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Invoices")}</h1>
          <p className="text-sm text-ink-muted">{t("Track what's owed and what's been paid.")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={exportHref} className="btn-secondary">
            <Download size={15} /> {t("Export CSV")}
          </a>
          <Link href="/invoices/new" className="btn-primary">
            <Plus size={15} /> {t("New invoice")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchBox placeholder="Search by customer…" />
          <DateRangeFilter />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={statusHref(undefined)}
            className={`stamp ${!searchParams.status ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
          >
            {t("All")}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={statusHref(s)}
              className={`stamp ${searchParams.status === s ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
            >
              {t(s)}
            </Link>
          ))}
        </div>
      </div>

      <Suspense fallback={<div className="text-sm text-ink-muted">{t("Loading…")}</div>}>
        <InvoiceList
          q={searchParams.q}
          status={searchParams.status}
          from={searchParams.from}
          to={searchParams.to}
        />
      </Suspense>
    </div>
  );
}
