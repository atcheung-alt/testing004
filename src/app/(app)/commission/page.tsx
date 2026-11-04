import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { commissionShareVisible, currentCommissionAccess } from "@/lib/documentAccess";
import { commissionDateName, commissionDayReached, formatCommissionDay } from "@/lib/commission";
import { loadCommissionMarks } from "@/lib/invoiceCommission";
import { loadClientSources } from "@/lib/clientSource";
import { commissionSplitFromStored } from "@/lib/quotationShares";
import { colleagueLabel } from "@/lib/staffCode";
import { loadColleagues } from "@/lib/quotationAuthor";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: { kind?: string; state?: string; source?: string };
}) {
  const t = getT();
  const access = await currentCommissionAccess();
  const kind = searchParams.kind === "event" || searchParams.kind === "recruitment" ? searchParams.kind : "";
  const state = searchParams.state === "pending" || searchParams.state === "done" ? searchParams.state : "";
  const source = searchParams.source || "";
  const [invoices, colleagues] = await Promise.all([
    access.mode === "none"
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            customerName: true,
            title: true,
            total: true,
            quotation: {
              select: {
                shareMode: true,
                shares: { select: { colleagueName: true, value: true } },
              },
            },
          },
        }),
    loadColleagues(),
  ]);
  const marks = await loadCommissionMarks(invoices.map((invoice) => invoice.id));
  const sources = await loadClientSources(invoices.map((invoice) => invoice.id));
  const wanted = kind === "event" ? "EVENT" : kind === "recruitment" ? "RECRUITMENT" : "";

  const rows = invoices.flatMap((invoice) => {
    const mark = marks.get(invoice.id) || null;
    if (wanted && mark?.workKind !== wanted) return [];
    if (source && (sources.get(invoice.id) || "") !== source) return [];
    const done = mark ? commissionDayReached(mark.day) : false;
    if (state === "pending" && (!mark || done)) return [];
    if (state === "done" && !done) return [];
    const split = commissionSplitFromStored(invoice.quotation?.shareMode || "AMOUNT", invoice.quotation?.shares || [], invoice.total);
    return split.partners.flatMap((partner) => {
      if (!commissionShareVisible(partner.colleagueName, access)) return [];
      if (!(split.total > 0) && !(partner.percent > 0)) return [];
      return [
        {
          id: `${invoice.id}-${partner.colleagueName}`,
          invoiceId: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          title: invoice.title,
          person: colleagueLabel(partner.colleagueName, colleagues),
          amount: (split.total * partner.percent) / 100,
          mark,
          done,
          source: sources.get(invoice.id) || "",
        },
      ];
    });
  });

  function href(next: { kind?: string; state?: string; source?: string }) {
    const params = new URLSearchParams();
    const nextKind = next.kind === undefined ? kind : next.kind;
    const nextState = next.state === undefined ? state : next.state;
    const nextSource = next.source === undefined ? source : next.source;
    if (nextKind) params.set("kind", nextKind);
    if (nextState) params.set("state", nextState);
    if (nextSource) params.set("source", nextSource);
    const query = params.toString();
    return `/commission${query ? `?${query}` : ""}`;
  }

  function stamp(active: boolean) {
    return `stamp ${active ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageBar title={t("Commission")} note={t("Pending until the date. Done once that day has arrived.")} />
      <div className="flex flex-wrap gap-2">
        <Link href={href({ kind: "" })} className={stamp(!kind)}>{t("All")}</Link>
        <Link href={href({ kind: "event" })} className={stamp(kind === "event")}>{t("Event")}</Link>
        <Link href={href({ kind: "recruitment" })} className={stamp(kind === "recruitment")}>{t("Recruitment")}</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ state: "" })} className={stamp(!state)}>{t("All")}</Link>
        <Link href={href({ state: "pending" })} className={stamp(state === "pending")}>{t("Pending")}</Link>
        <Link href={href({ state: "done" })} className={stamp(state === "done")}>{t("Done")}</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={href({ source: "" })} className={stamp(!source)}>{t("All sources")}</Link>
        {Array.from(new Set([...sources.values()].filter(Boolean))).map((name) => (
          <Link key={name} href={href({ source: name })} className={stamp(source === name)}>{name}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="card px-5 py-8 text-sm text-ink-muted">{t("Nothing matches.")}</div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/invoices/${row.invoiceId}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-paper"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">{row.number}</span>
                  {row.mark ? (
                    <span className="stamp border-line text-ink-muted">
                      {t(row.mark.workKind === "RECRUITMENT" ? "Recruitment" : "Event")}
                    </span>
                  ) : null}
                  {row.mark ? (
                    <span className={`stamp ${row.done ? "border-accent-500 text-accent-600" : "border-line text-ink-muted"}`}>
                      {t(row.done ? "Done" : "Pending")}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-ink-muted mt-1 truncate">
                  {row.customerName}
                  {row.title ? ` · ${row.title}` : ""}
                  {access.mode === "all" ? ` · ${row.person}` : ""}
                  {row.mark ? ` · ${t(commissionDateName(row.mark.workKind))} ${formatCommissionDay(row.mark.day)}` : ""}
                  {row.source ? ` · ${row.source}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Commission")}</p>
                <p className="font-mono text-sm text-ink">{formatCurrency(row.amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
