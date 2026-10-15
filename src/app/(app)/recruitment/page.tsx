import Link from "next/link";
import { Suspense } from "react";
import { Plus, Briefcase, Table2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { dateRangeFilter } from "@/lib/dateRange";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import SearchBox from "@/components/SearchBox";
import DateRangeFilter from "@/components/DateRangeFilter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "SENT", "SIGNED", "CANCELLED"];

async function RecruitmentList({
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
  const agreements = await prisma.recruitmentAgreement.findMany({
    where: {
      status: status || undefined,
      createdAt: dateRangeFilter(from, to),
      OR: q
        ? [
            { companyName: { contains: q, mode: "insensitive" } },
            { companyEmail: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  if (agreements.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title={t("No recruitment agreements found")}
        description={t("Try adjusting your filters, or create a new agreement.")}
        actionHref="/recruitment/new"
        actionLabel={t("New agreement")}
      />
    );
  }

  return (
    <div className="card divide-y divide-line">
      {agreements.map((a) => (
        <Link
          key={a.id}
          href={`/recruitment/${a.id}`}
          className="flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-paper transition-colors gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{a.number}</span>
              <StatusBadge status={a.status} />
            </div>
            <p className="text-xs text-ink-muted truncate mt-0.5">
              {a.companyName} · {t("Created {date}", { date: formatDate(a.createdAt) })}
            </p>
          </div>
          <span className="text-xs text-ink-faint shrink-0">{t("Net {days} days", { days: a.paymentDueDays })}</span>
        </Link>
      ))}
    </div>
  );
}

export default function RecruitmentPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; from?: string; to?: string };
}) {
  const t = getT();
  function statusHref(status?: string) {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (status) params.set("status", status);
    return `/recruitment${params.toString() ? `?${params}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Recruitment Agreements")}</h1>
          <p className="text-sm text-ink-muted">
            {t("Recruitment services terms — a separate system from quotations/invoices/receipts.")}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/recruitment/fee-scale" className="btn-secondary">
            <Table2 size={15} /> {t("Fee scale library")}
          </Link>
          <Link href="/recruitment/new" className="btn-primary">
            <Plus size={15} /> {t("New agreement")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchBox placeholder="Search by company…" />
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
        <RecruitmentList
          q={searchParams.q}
          status={searchParams.status}
          from={searchParams.from}
          to={searchParams.to}
        />
      </Suspense>
    </div>
  );
}
