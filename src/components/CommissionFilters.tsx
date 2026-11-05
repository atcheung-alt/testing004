"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import CommissionPaidToggle from "@/components/CommissionPaidToggle";
import { hongKongDay } from "@/lib/commission";

export type BillingRow = {
  id: string;
  invoiceId: string;
  number: string;
  customerName: string;
  title: string;
  person: string;
  colleagueName: string;
  nickname: string;
  legalName: string;
  detail: string;
  amount: string;
  amountValue: number;
  kind: "" | "EVENT" | "RECRUITMENT";
  day: string;
  done: boolean;
  paidDay: string;
};

export default function CommissionFilters({
  kind,
  state,
  from,
  to,
  paid,
  who,
  months,
  year,
  people,
  rows,
  marked,
  canPay,
  labels,
}: {
  kind: string;
  state: string;
  from: string;
  to: string;
  paid: string;
  who: string;
  months: string[];
  year: string;
  people: { code: string; nickname: string; name: string }[];
  rows: BillingRow[];
  marked: number;
  canPay: boolean;
  labels: {
    type: string;
    status: string;
    from: string;
    to: string;
    payment: string;
    all: string;
    event: string;
    recruitment: string;
    pending: string;
    done: string;
    allTime: string;
    unpaid: string;
    paid: string;
    allStaff: string;
    search: string;
    empty: string;
    nothing: string;
    noneSaved: string;
    noColleague: string;
    billing: string;
    paidWord: string;
    unpaidWord: string;
    markPaid: string;
    markUnpaid: string;
    markQuestion: string;
    undoQuestion: string;
    confirm: string;
    cancel: string;
    pageTitle: string;
    pageNote: string;
    exportCsv: string;
  };
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const needle = query.trim().toLowerCase();
  const suggestions = useMemo(
    () => people.filter((person) => [person.nickname, person.name, person.code].join(" ").toLowerCase().includes(needle)),
    [people, needle]
  );
  const shown = rows.filter((row) => {
    if (!needle) return true;
    return [row.person, row.colleagueName, row.nickname, row.legalName].join(" ").toLowerCase().includes(needle);
  });
  const colleagueFilter = Boolean(needle || who);

  useEffect(() => {
    if (!needle) return;
    function place() {
      const rect = searchRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuBox({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [needle, suggestions.length]);

  function exportCsv() {
    const header = ["Invoice Number", "Type", "Date", "Assigned Colleague", "Billing Amount (HK$)", "Status", "Payment Status"];
    const lines = [header.join(",")].concat(shown.map((row) => [
      row.number,
      row.kind === "RECRUITMENT" ? labels.recruitment : row.kind === "EVENT" ? labels.event : "",
      row.day,
      row.person,
      row.amountValue,
      row.done ? labels.done : labels.pending,
      row.paidDay ? "PAID" : "UNPAID",
    ].map((value) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    }).join(",")));
    const file = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = `my_billing_export_${hongKongDay(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">{labels.pageTitle}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{labels.pageNote}</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={exportCsv}>
          <Download size={15} /> {labels.exportCsv}
        </button>
      </div>
      <form
        id="billing-filters"
        action="/commission"
        method="get"
        className="flex flex-wrap items-center gap-2"
        onChange={(event) => {
          if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
        }}
      >
        <label className="relative min-w-[12rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={labels.search}
            aria-label={labels.search}
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            onChange={(event) => setQuery(event.target.value)}
          />
          {needle && menuBox && typeof document !== "undefined"
            ? createPortal(
              <div className="fixed z-[9999] rounded-xl border border-line bg-surface p-1.5 shadow-card" style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}>
                {suggestions.length ? suggestions.map((person) => (
                  <button
                    key={person.code}
                    type="submit"
                    form="billing-filters"
                    name="who"
                    value={person.code}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper"
                    onClick={() => setQuery("")}
                  >
                    {person.nickname || person.name}
                    {person.name && person.name !== person.nickname ? <span className="text-ink-muted"> · {person.name}</span> : null}
                  </button>
                )) : <p className="px-2 py-2 text-sm text-ink-muted">{labels.empty}</p>}
              </div>,
              document.body
            )
            : null}
        </label>
        <select name="kind" defaultValue={kind} aria-label={labels.type} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">{labels.type}: {labels.all}</option>
          <option value="event">{labels.type}: {labels.event}</option>
          <option value="recruitment">{labels.type}: {labels.recruitment}</option>
        </select>
        <select name="state" defaultValue={state} aria-label={labels.status} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">{labels.status}: {labels.all}</option>
          <option value="pending">{labels.status}: {labels.pending}</option>
          <option value="done">{labels.status}: {labels.done}</option>
        </select>
        <select name="paid" defaultValue={paid} aria-label={labels.payment} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">{labels.payment}: {labels.all}</option>
          <option value="unpaid">{labels.payment}: {labels.unpaid}</option>
          <option value="paid">{labels.payment}: {labels.paid}</option>
        </select>
        {people.length ? (
          <select name="who" defaultValue={who} aria-label={labels.allStaff} className="h-9 max-w-[14rem] rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
            <option value="">{labels.allStaff}</option>
            {people.map((person) => (
              <option key={person.code} value={person.code}>
                {(person.nickname || person.name || person.code)}{person.name && person.name !== person.nickname ? ` · ${person.name}` : ""}
              </option>
            ))}
          </select>
        ) : null}
        <div className="ml-auto flex gap-2">
          <select name="from" defaultValue={from} aria-label={labels.from} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
            <option value="">{labels.from}: {labels.allTime}</option>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
              .concat(months.filter((month) => !month.startsWith(`${year}-`)))
              .map((month) => (
                <option key={month} value={month}>{labels.from}: {month}</option>
              ))}
          </select>
          <select name="to" defaultValue={to} aria-label={labels.to} className="h-9 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
            <option value="">{labels.to}: {labels.allTime}</option>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
              .concat(months.filter((month) => !month.startsWith(`${year}-`)))
              .map((month) => (
                <option key={month} value={month}>{labels.to}: {month}</option>
              ))}
          </select>
        </div>
      </form>
      {shown.length === 0 ? (
        <div className="card relative z-0 px-5 py-8 text-sm text-ink-muted">
          {colleagueFilter
            ? labels.noColleague
            : marked === 0
              ? labels.noneSaved
              : labels.nothing}
        </div>
      ) : (
        <div className="card relative z-0 divide-y divide-line">
          {shown.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <Link href={`/invoices/${row.invoiceId}`} className="font-mono text-sm font-medium hover:text-brand-600">{row.number}</Link>
                <p className="mt-0.5 text-sm text-ink">
                  {row.customerName}
                  {row.title ? ` · ${row.title}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{row.detail}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={row.done ? "text-emerald-700" : "text-amber-700"}>{row.done ? labels.done : labels.pending}</span>
                  <span className="text-ink-faint">·</span>
                  {canPay ? (
                    <CommissionPaidToggle
                      invoiceId={row.invoiceId}
                      colleagueName={row.colleagueName}
                      paid={Boolean(row.paidDay)}
                      paidDay={row.paidDay}
                      paidWord={labels.paidWord}
                      unpaidLabel={labels.unpaidWord}
                      markLabel={labels.markPaid}
                      undoLabel={labels.markUnpaid}
                      markQuestion={labels.markQuestion}
                      undoQuestion={labels.undoQuestion}
                      confirmLabel={labels.confirm}
                      cancelLabel={labels.cancel}
                    />
                  ) : (
                    <span className={row.paidDay ? "text-emerald-700" : "text-ink-muted"}>
                      {row.paidDay ? `${labels.paidWord} ${row.paidDay}` : labels.unpaidWord}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{labels.billing}</p>
                <p className="font-mono text-sm text-ink">{row.amount}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
