import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { commissionShareVisible, commissionOwnedInvoiceIds, currentCommissionAccess } from "@/lib/documentAccess";
import { commissionDayReached, hongKongDay } from "@/lib/commission";
import { loadCommissionMarks } from "@/lib/invoiceCommission";
import { loadCommissionPaid } from "@/lib/commissionPaid";
import { commissionSplitFromStored } from "@/lib/quotationShares";
import { colleagueLabel } from "@/lib/staffCode";
import { loadColleagues } from "@/lib/quotationAuthor";
import PageBar from "@/components/PageBar";
import CommissionFilters from "@/components/CommissionFilters";
import CommissionPaidToggle from "@/components/CommissionPaidToggle";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: { kind?: string; state?: string; when?: string; paid?: string; who?: string };
}) {
  const t = getT();
  const access = await currentCommissionAccess();
  const kind = searchParams.kind === "event" || searchParams.kind === "recruitment" ? searchParams.kind : "";
  const state = searchParams.state === "pending" || searchParams.state === "done" ? searchParams.state : "";
  const paid = searchParams.paid === "unpaid" || searchParams.paid === "paid" ? searchParams.paid : "";
  const who = access.mode === "all" ? searchParams.who || "" : "";
  const when = /^\d{4}-\d{2}$/.test(searchParams.when || "") || /^\d{4}-Q[1-4]$/.test(searchParams.when || "") ? searchParams.when || "" : "";
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
  const paidOn = await loadCommissionPaid(invoices.map((invoice) => invoice.id));
  const owned = await commissionOwnedInvoiceIds(access);
  const wanted = kind === "event" ? "EVENT" : kind === "recruitment" ? "RECRUITMENT" : "";
  const today = hongKongDay(new Date());

  function inPeriod(day: string) {
    if (!when) return true;
    if (/^\d{4}-\d{2}$/.test(when)) return day.startsWith(when);
    const quarter = /^(\d{4})-Q([1-4])$/.exec(when);
    if (!quarter) return true;
    const month = Number(day.slice(5, 7));
    return day.startsWith(quarter[1]) && Math.ceil(month / 3) === Number(quarter[2]);
  }

  const rows = invoices.flatMap((invoice) => {
    const mark = marks.get(invoice.id) || null;
    if (!mark || !/^\d{4}-\d{2}-\d{2}$/.test(mark.day)) return [];
    if (wanted && mark.workKind !== wanted) return [];
    if (!inPeriod(mark.day)) return [];
    const done = commissionDayReached(mark.day);
    if (state === "pending" && done) return [];
    if (state === "done" && !done) return [];
    const createdByMe = owned ? owned.has(invoice.id) : false;
    const split = commissionSplitFromStored(invoice.quotation?.shareMode || "AMOUNT", invoice.quotation?.shares || [], invoice.total);
    const partners = split.partners.length ? split.partners : [{ colleagueName: "", percent: 100 }];
    return partners.flatMap((partner) => {
      const shared = commissionShareVisible(partner.colleagueName, access);
      if (access.mode === "self" && !createdByMe && !shared) return [];
      if (access.mode !== "all" && access.mode !== "self") return [];
      if (who && partner.colleagueName !== who) return [];
      const paidDay = paidOn.get(`${invoice.id}\n${partner.colleagueName.trim()}`) || "";
      if (paid === "paid" && !paidDay) return [];
      if (paid === "unpaid" && paidDay) return [];
      return [
        {
          id: `${invoice.id}-${partner.colleagueName}`,
          invoiceId: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          title: invoice.title,
          colleagueName: partner.colleagueName,
          person: colleagueLabel(partner.colleagueName, colleagues),
          amount: (split.total * partner.percent) / 100,
          mark,
          done,
          paidDay,
        },
      ];
    });
  });

  const months = Array.from(new Set([
    today.slice(0, 7),
    ...Array.from(marks.values()).map((mark) => mark.day.slice(0, 7)),
  ])).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort().reverse();

  return (
    <div className="flex flex-col gap-4">
      <PageBar title={t("Billing")} note={t("Pending until the date. Done once that day has arrived.")} />
      <CommissionFilters
        kind={kind}
        state={state}
        when={when}
        paid={paid}
        who={access.mode === "all" ? who : ""}
        months={months}
        year={today.slice(0, 4)}
        people={access.mode === "all" ? colleagues.map((person) => ({ code: person.code, nickname: person.nickname || "", name: person.name || "" })) : []}
        labels={{
          type: t("Type"),
          status: t("Status"),
          when: t("When"),
          payment: t("Payment"),
          all: t("All"),
          event: t("Event"),
          recruitment: t("Recruitment"),
          pending: t("Pending"),
          done: t("Done"),
          allTime: t("All time"),
          unpaid: t("Unpaid"),
          paid: t("Paid"),
          allStaff: t("All staff"),
          search: t("Search colleague"),
          empty: t("No matching colleague"),
        }}
      />
      {rows.length === 0 ? (
        <div className="card px-5 py-8 text-sm text-ink-muted">{t("Nothing matches.")}</div>
      ) : (
        <div className="card divide-y divide-line">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4"
            >
              <div className="min-w-0">
                <Link href={`/invoices/${row.invoiceId}`} className="font-mono text-sm font-medium hover:text-brand-600">{row.number}</Link>
                <p className="mt-0.5 text-sm text-ink">
                  {row.customerName}
                  {row.title ? ` · ${row.title}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {[
                    row.person,
                    t(row.mark.workKind === "RECRUITMENT" ? "Recruitment" : "Event"),
                    `${t(row.mark.workKind === "RECRUITMENT" ? "Onboarding" : "Recognise Date")} ${row.mark.day}`,
                  ].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={row.done ? "text-emerald-700" : "text-amber-700"}>{t(row.done ? "Done" : "Pending")}</span>
                  <span className="text-ink-faint">·</span>
                  {access.mode === "all" ? (
                    <CommissionPaidToggle
                      invoiceId={row.invoiceId}
                      colleagueName={row.colleagueName}
                      paid={Boolean(row.paidDay)}
                      paidLabel={row.paidDay ? `${t("Paid")} ${row.paidDay}` : t("Unpaid")}
                      unpaidLabel={t("Unpaid")}
                      markLabel={t("Mark paid")}
                      undoLabel={t("Mark unpaid")}
                      markQuestion={t("Mark this commission as paid?")}
                      undoQuestion={t("Change this commission back to unpaid?")}
                      confirmLabel={t("Confirm")}
                      cancelLabel={t("Cancel")}
                    />
                  ) : (
                    <span className={row.paidDay ? "text-emerald-700" : "text-ink-muted"}>
                      {row.paidDay ? `${t("Paid")} ${row.paidDay}` : t("Unpaid")}
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{t("Billing")}</p>
                <p className="font-mono text-sm text-ink">{formatCurrency(row.amount)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
