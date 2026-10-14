import Link from "next/link";
import { Suspense } from "react";
import { Plus, FileText, Download, LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { dateRangeFilter } from "@/lib/dateRange";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import SearchBox from "@/components/SearchBox";
import DateRangeFilter from "@/components/DateRangeFilter";
import { getT } from "@/lib/i18n/server";
import { companyWhere } from "@/lib/access";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED", "CONVERTED"];

async function QuotationList({
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
  const quotations = await prisma.quotation.findMany({
    where: {
      ...(await companyWhere()),
      status: status || undefined,
      issueDate: dateRangeFilter(from, to),
      OR: q
        ? [
            { customerName: { contains: q, mode: "insensitive" } },
            { customerEmail: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    // Just enough to preview on the list row (see the items line below) —
    // the full set with pricing/fees is only ever needed on the detail
    // page, which fetches its own complete `items` include separately.
    include: { items: { select: { name: true }, orderBy: { sortOrder: "asc" }, take: 5 } },
  });

  if (quotations.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={t("No quotations found")}
        description={t("Try adjusting your filters, or create a new quotation.")}
        actionHref="/quotations/new"
        actionLabel={t("New quotation")}
      />
    );
  }

  return (
    <div className="card divide-y divide-line">
      {quotations.map((q) => (
        <Link
          key={q.id}
          href={`/quotations/${q.id}`}
          className="flex items-center justify-between px-4 sm:px-5 py-5 hover:bg-paper transition-colors gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{q.number}</span>
              <StatusBadge status={q.status} />
            </div>
            <p className="text-xs text-ink-muted truncate mt-0.5">
              {q.customerName} · {t("Issued {date}", { date: formatDate(q.issueDate) })}
            </p>
            {/* Always rendered (even blank) so every row reserves the
                same vertical space regardless of item count — keeps every
                row's height consistent. */}
            <p className="text-xs text-ink-faint truncate mt-0.5">
              {q.items.length > 0 ? q.items.map((item) => item.name || t("Untitled item")).join(" \u00b7 ") : "\u00a0"}
            </p>
          </div>
          <span className="font-mono text-sm font-medium shrink-0">{formatCurrency(q.total)}</span>
        </Link>
      ))}
    </div>
  );
}

export default function QuotationsPage({
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
  const exportHref = `/api/quotations/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  // Status tabs need to carry forward whatever search/date filters are
  // already active — otherwise clicking a status tab silently wipes them.
  function statusHref(status?: string) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (status) params.set("status", status);
    return `/quotations${params.toString() ? `?${params}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Quotations")}</h1>
          <p className="text-sm text-ink-muted">{t("Draft, send, and track quotations for your customers.")}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={exportHref} className="btn-secondary">
            <Download size={15} /> {t("Export CSV")}
          </a>
          <Link href="/quotations/templates" className="btn-secondary">
            <LayoutTemplate size={15} /> {t("Templates")}
          </Link>
          <Link href="/quotations/new" className="btn-primary">
            <Plus size={15} /> {t("New quotation")}
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
        <QuotationList
          q={searchParams.q}
          status={searchParams.status}
          from={searchParams.from}
          to={searchParams.to}
        />
      </Suspense>
    </div>
  );
}
