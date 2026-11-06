import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { commissionShareVisible, commissionOwnedInvoiceIds, currentCommissionAccess } from "@/lib/documentAccess";
import { commissionDayReached, commissionDayInWhen, hongKongDay } from "@/lib/commission";
import { loadCommissionMarks } from "@/lib/invoiceCommission";
import { loadCommissionPaid } from "@/lib/commissionPaid";
import { commissionSplitFromStored } from "@/lib/quotationShares";
import { colleagueLabel } from "@/lib/staffCode";
import { loadColleagues } from "@/lib/quotationAuthor";
import CommissionFilters from "@/components/CommissionFilters";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: { kind?: string; state?: string; from?: string; to?: string; paid?: string; who?: string };
}) {
  const t = getT();
  const access = await currentCommissionAccess();
  const kind = searchParams.kind === "event" || searchParams.kind === "recruitment" ? searchParams.kind : "";
  const state = searchParams.state === "pending" || searchParams.state === "done" ? searchParams.state : "";
  const paid = searchParams.paid === "unpaid" || searchParams.paid === "paid" ? searchParams.paid : "";
  const who = access.mode === "all" ? searchParams.who || "" : "";
  const month = (value?: string) => (/^\d{4}-\d{2}$/.test(value || "") ? value || "" : "");
  const pickedFrom = month(searchParams.from);
  const pickedTo = month(searchParams.to);
  const rangeStart = pickedFrom && pickedTo && pickedFrom > pickedTo ? pickedTo : pickedFrom;
  const rangeEnd = pickedFrom && pickedTo && pickedFrom > pickedTo ? pickedFrom : pickedTo;
  const when = rangeStart && rangeEnd ? `${rangeStart}..${rangeEnd}` : rangeStart || rangeEnd;
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
            status: true,
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
    return commissionDayInWhen(day, when);
  }

  const rows = invoices.flatMap((invoice) => {
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") return [];
    const mark = marks.get(invoice.id) || null;
    const dated = Boolean(mark && /^\d{4}-\d{2}-\d{2}$/.test(mark.day));
    if (!dated) {
      if (wanted) return [];
      if (!commissionDayInWhen(today, when)) return [];
    } else {
      if (wanted && mark!.workKind !== wanted) return [];
      if (!inPeriod(mark!.day)) return [];
    }
    const done = dated ? commissionDayReached(mark!.day) : true;
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
          nickname: colleagues.find((person) => person.code === partner.colleagueName)?.nickname || "",
          legalName: colleagues.find((person) => person.code === partner.colleagueName)?.name || "",
          amount: (split.total * partner.percent) / 100,
          mark,
          done,
          paidDay,
        },
      ];
    });
  });

  const marked = invoices.filter((invoice) => {
    const mark = marks.get(invoice.id);
    return Boolean(mark && /^\d{4}-\d{2}-\d{2}$/.test(mark.day));
  }).length;

  return (
    <div className="flex flex-col gap-4">
      <CommissionFilters
        kind={kind}
        state={state}
        from={rangeStart || pickedFrom}
        to={rangeEnd || pickedTo}
        paid={paid}
        who={access.mode === "all" ? who : ""}
        people={access.mode === "all" ? colleagues.map((person) => ({ code: person.code, nickname: person.nickname || "", name: person.name || "" })) : []}
        marked={marked}
        canPay={access.mode === "all"}
        rows={rows.map((row) => ({
          id: row.id,
          invoiceId: row.invoiceId,
          number: row.number,
          customerName: row.customerName,
          title: row.title,
          person: row.person,
          colleagueName: row.colleagueName,
          nickname: row.nickname,
          legalName: row.legalName,
          detail: [
            row.person,
            row.mark ? t(row.mark.workKind === "RECRUITMENT" ? "Recruitment" : "Event") : "",
            row.mark
              ? `${t(row.mark.workKind === "RECRUITMENT" ? "Onboarding" : "Recognise Date")} ${row.mark.day}`
              : t("No date"),
          ].filter(Boolean).join(" · "),
          amount: formatCurrency(row.amount),
          amountValue: row.amount,
          kind: row.mark?.workKind || "",
          day: row.mark && /^\d{4}-\d{2}-\d{2}$/.test(row.mark.day) ? row.mark.day : "",
          done: row.done,
          paidDay: row.paidDay,
        }))}
        labels={{
          type: t("Type"),
          status: t("Status"),
          from: t("From"),
          to: t("to"),
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
          search: t("Search colleague, invoice, or project..."),
          empty: t("No matching colleague"),
          nothing: t("Nothing matches."),
          noneSaved: t("No invoice has Event or Recruitment with a date saved yet. Booking dates on an invoice are not used here."),
          noColleague: t("No records found for this colleague"),
          billing: t("Billing"),
          paidWord: t("Paid"),
          unpaidWord: t("Unpaid"),
          markPaid: t("Mark paid"),
          markUnpaid: t("Mark unpaid"),
          markQuestion: t("Mark this commission as paid?"),
          undoQuestion: t("Change this commission back to unpaid?"),
          confirm: t("Confirm"),
          cancel: t("Cancel"),
          pageTitle: t("Commission"),
          pageNote: t("Pending until the date. Done once that day has arrived."),
          exportCsv: t("Export CSV"),
        }}
      />
    </div>
  );
}
