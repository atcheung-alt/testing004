"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CalendarRange, Download, Search } from "lucide-react";
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
  formula: string;
  amount: string;
  amountValue: number;
  kind: "" | "EVENT" | "RECRUITMENT";
  day: string;
  done: boolean;
  paidDay: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MonthField({ name, value, label, allTime }: { name: string; value: string; label: string; allTime: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const now = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(value ? Number(value.slice(0, 4)) : now);
  const min = now - 5;
  const max = now + 5;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(next: string) {
    if (inputRef.current) inputRef.current.value = next;
    setOpen(false);
    inputRef.current?.form?.requestSubmit();
  }

  return (
    <div ref={boxRef} className="relative">
      <input ref={inputRef} type="hidden" name={name} defaultValue={value} />
      <button type="button" aria-label={label} className="input !w-auto text-left" onClick={() => setOpen((current) => !current)}>
        {value || allTime}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-line bg-surface p-2.5 shadow-card">
          <button type="button" className={`mb-2 w-full rounded-lg px-2 py-1.5 text-sm ${value ? "bg-paper text-ink" : "bg-brand-50 text-brand-600"}`} onClick={() => choose("")}>{allTime}</button>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="h-7 w-7 rounded-lg border border-line" disabled={year <= min} onClick={() => setYear((current) => current - 1)}>‹</button>
            <span className="text-sm text-ink">{year}</span>
            <button type="button" className="h-7 w-7 rounded-lg border border-line" disabled={year >= max} onClick={() => setYear((current) => current + 1)}>›</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((month, index) => {
              const next = `${year}-${String(index + 1).padStart(2, "0")}`;
              return (
                <button key={month} type="button" className={`rounded-lg px-2 py-1.5 text-sm ${value === next ? "bg-brand-50 text-brand-600" : "bg-paper text-ink"}`} onClick={() => choose(next)}>
                  {month}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CommissionFilters({
  kind,
  state,
  from,
  to,
  paid,
  who,
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
    return [row.person, row.colleagueName, row.nickname, row.legalName, row.number, row.customerName, row.title].join(" ").toLowerCase().includes(needle);
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
      <div className="sticky-filters flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{labels.pageTitle}</h1>
          <p className="lead">{labels.pageNote}</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={exportCsv}>
          <Download size={15} /> {labels.exportCsv}
        </button>
      </div>
      <div className="flex flex-col gap-3">
      <form
        id="billing-filters"
        action="/commission"
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onChange={(event: FormEvent<HTMLFormElement>) => {
          if ((event.target as HTMLElement).tagName === "SELECT") event.currentTarget.requestSubmit();
        }}
      >
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="paid" value={paid} />
        <input type="hidden" name="kind" value={kind} />
        <label className="relative w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={labels.search}
            aria-label={labels.search}
            autoComplete="off"
            className="input pl-9"
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
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="shrink-0 text-ink-faint" />
          <MonthField name="from" value={from} label={labels.from} allTime={labels.allTime} />
          <span className="text-sm text-ink-faint">–</span>
          <MonthField name="to" value={to} label={labels.to} allTime={labels.allTime} />
        </div>
        {people.length ? (
          <select name="who" defaultValue={who} aria-label={labels.allStaff} className="input !w-auto max-w-[14rem]">
            <option value="">{labels.allStaff}</option>
            {people.map((person) => (
              <option key={person.code} value={person.code}>
                {(person.nickname || person.name || person.code)}{person.name && person.name !== person.nickname ? ` · ${person.name}` : ""}
              </option>
            ))}
          </select>
        ) : null}
      </form>
      <div className="flex flex-wrap gap-2">
        {([
          ["ALL", "", ""],
          ["PENDING", "pending", ""],
          ["DONE", "done", ""],
          ["UNPAID", "", "unpaid"],
          ["PAID", "", "paid"],
        ] as const).map(([name, nextState, nextPaid]) => {
          const active = paid ? paid === nextPaid && !nextState : state ? state === nextState && !nextPaid : name === "ALL";
          const params = new URLSearchParams();
          if (kind) params.set("kind", kind);
          if (who) params.set("who", who);
          if (from) params.set("from", from);
          if (to) params.set("to", to);
          if (nextState) params.set("state", nextState);
          if (nextPaid) params.set("paid", nextPaid);
          const href = params.toString() ? `/commission?${params}` : "/commission";
          return (
            <Link key={name} href={href} className={`stamp ${active ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}>
              {name === "ALL" ? labels.all : name === "PENDING" ? labels.pending : name === "DONE" ? labels.done : name === "UNPAID" ? labels.unpaid : labels.paid}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["", labels.all],
          ["event", labels.event],
          ["recruitment", labels.recruitment],
        ] as const).map(([nextKind, label]) => {
          const params = new URLSearchParams();
          if (nextKind) params.set("kind", nextKind);
          if (who) params.set("who", who);
          if (from) params.set("from", from);
          if (to) params.set("to", to);
          if (state) params.set("state", state);
          if (paid) params.set("paid", paid);
          const href = params.toString() ? `/commission?${params}` : "/commission";
          return (
            <Link key={nextKind || "all"} href={href} className={`stamp ${kind === nextKind ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}>
              {label}
            </Link>
          );
        })}
      </div>
      </div>
      </div>
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
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5">
              <div className="min-w-0">
                <Link href={`/invoices/${row.invoiceId}`} className="font-mono text-sm font-medium hover:text-brand-600">{row.number}</Link>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {row.customerName}
                  {row.title ? ` · ${row.title}` : ""}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{row.formula}</p>
                <p className="mt-0.5 truncate text-xs text-ink-faint">{row.detail}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${row.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{row.done ? labels.done : labels.pending}</span>
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
