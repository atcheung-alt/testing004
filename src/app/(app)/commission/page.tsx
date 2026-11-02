import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { commissionShareVisible, currentCommissionAccess } from "@/lib/documentAccess";
import { commissionSplitFromStored } from "@/lib/quotationShares";
import { colleagueLabel } from "@/lib/staffCode";
import { loadColleagues } from "@/lib/quotationAuthor";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: { kind?: string; state?: string };
}) {
  const t = getT();
  const access = await currentCommissionAccess();
  const kind = searchParams.kind === "event" || searchParams.kind === "recruitment" ? searchParams.kind : "";
  const state = searchParams.state === "pending" || searchParams.state === "done" ? searchParams.state : "";
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

  const rows = kind || state ? [] : invoices.flatMap((invoice) => {
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
        },
      ];
    });
  });

  function href(next: { kind?: string; state?: string }) {
    const params = new URLSearchParams();
    const nextKind = next.kind === undefined ? kind : next.kind;
    const nextState = next.state === undefined ? state : next.state;
    if (nextKind) params.set("kind", nextKind);
    if (nextState) params.set("state", nextState);
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
                </div>
                <p className="text-xs text-ink-muted mt-1 truncate">
                  {row.customerName}
                  {row.title ? ` · ${row.title}` : ""}
                  {access.mode === "all" ? ` · ${row.person}` : ""}
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
