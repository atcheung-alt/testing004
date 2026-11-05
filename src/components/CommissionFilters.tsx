"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CommissionPaidToggle from "@/components/CommissionPaidToggle";

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
  };
}) {
  const [query, setQuery] = useState("");
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

  return (
    <>
      <form
        action="/commission"
        method="get"
        className="card relative z-20 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4"
        onChange={(event) => {
          if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
        }}
      >
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          {labels.type}
          <select name="kind" defaultValue={kind} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{labels.all}</option>
            <option value="event">{labels.event}</option>
            <option value="recruitment">{labels.recruitment}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          {labels.status}
          <select name="state" defaultValue={state} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{labels.all}</option>
            <option value="pending">{labels.pending}</option>
            <option value="done">{labels.done}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          {labels.from}
          <select name="from" defaultValue={from} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{labels.allTime}</option>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
              .concat(months.filter((month) => !month.startsWith(`${year}-`)))
              .map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          {labels.to}
          <select name="to" defaultValue={to} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{labels.allTime}</option>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
              .concat(months.filter((month) => !month.startsWith(`${year}-`)))
              .map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
          {labels.payment}
          <select name="paid" defaultValue={paid} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{labels.all}</option>
            <option value="unpaid">{labels.unpaid}</option>
            <option value="paid">{labels.paid}</option>
          </select>
        </label>
        {people.length ? (
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row xl:col-span-4">
            <label className="relative flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-ink-muted">
              {labels.search}
              <input
                type="search"
                value={query}
                placeholder={labels.search}
                aria-label={labels.search}
                autoComplete="off"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                onChange={(event) => setQuery(event.target.value)}
              />
              {needle ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-line bg-surface p-1.5 shadow-card">
                  {suggestions.length ? suggestions.map((person) => (
                    <button
                      key={person.code}
                      type="submit"
                      name="who"
                      value={person.code}
                      className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper"
                      onClick={() => setQuery("")}
                    >
                      {person.nickname || person.name}
                      {person.name && person.name !== person.nickname ? <span className="text-ink-muted"> · {person.name}</span> : null}
                    </button>
                  )) : <p className="px-2 py-2 text-sm text-ink-muted">{labels.empty}</p>}
                </div>
              ) : null}
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-ink-muted">
              {labels.allStaff}
              <select name="who" defaultValue={who} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
                <option value="">{labels.allStaff}</option>
                {people.map((person) => (
                  <option key={person.code} value={person.code}>
                    {(person.nickname || person.name || person.code)}{person.name && person.name !== person.nickname ? ` · ${person.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
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
                      paidLabel={row.paidDay ? `${labels.paidWord} ${row.paidDay}` : labels.unpaidWord}
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
