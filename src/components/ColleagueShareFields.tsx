"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";
import type { StaffColleague } from "@/lib/staffCode";

export type ColleagueShare = {
  id: string;
  colleagueName: string;
  value: number;
};

const PARTNER_COLORS = ["#0f9f8f", "#d0891f", "#3d7eef", "#e15b8a", "#7b6b90"];

export function emptyColleagueShare(colleagueName = "", value = 0): ColleagueShare {
  return { id: Math.random().toString(36).slice(2), colleagueName, value };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function colleagueMatches(person: StaffColleague, needle: string) {
  if (!needle) return true;
  return [person.nickname, person.name, person.code].join(" ").toLowerCase().includes(needle);
}

function ColleaguePicker({
  share,
  colleagues,
  open,
  query,
  pickerRef,
  onQueryChange,
  onToggle,
  onChoose,
  labelFor,
}: {
  share: ColleagueShare;
  colleagues: StaffColleague[];
  open: boolean;
  query: string;
  pickerRef?: RefObject<HTMLDivElement>;
  onQueryChange: (value: string) => void;
  onToggle: () => void;
  onChoose: (code: string) => void;
  labelFor: (code: string) => string;
}) {
  const t = useT();
  const needle = query.trim().toLowerCase();
  const options = colleagues.filter((person) => colleagueMatches(person, needle));
  const storedOutsideList =
    share.colleagueName && !colleagues.some((person) => person.code === share.colleagueName) ? share.colleagueName : "";
  const showStored = Boolean(storedOutsideList) && (!needle || storedOutsideList.toLowerCase().includes(needle));
  const chosen = share.colleagueName ? labelFor(share.colleagueName) : "";

  return (
    <div className="relative min-w-[9rem] flex-1" ref={pickerRef}>
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 py-1.5 text-left"
        aria-label={t("Colleague")}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={chosen ? "truncate" : "truncate text-ink-faint"}>{chosen || t("Choose a colleague")}</span>
        <ChevronDown size={14} className="shrink-0 text-ink-muted" />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 min-w-[220px] rounded-xl border border-line bg-surface p-1.5 shadow-card">
          <input
            className="input py-1.5"
            type="search"
            autoFocus
            placeholder={t("Search colleague")}
            aria-label={t("Search colleague")}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <div className="mt-1 max-h-56 overflow-auto">
            {showStored ? (
              <button
                type="button"
                className="block w-full rounded-lg bg-paper px-2 py-1.5 text-left text-sm text-ink"
                onClick={() => onChoose(storedOutsideList)}
              >
                {storedOutsideList}
              </button>
            ) : null}
            {options.map((person) => (
              <button
                key={person.code}
                type="button"
                className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-paper ${person.code === share.colleagueName ? "bg-paper" : ""}`}
                onClick={() => onChoose(person.code)}
              >
                {labelFor(person.code)}
              </button>
            ))}
            {options.length === 0 && !showStored ? (
              <p className="px-2 py-2 text-sm text-ink-muted">{t("No matching colleague")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ColleagueShareFields({
  creatorName,
  commissionTotal,
  onCommissionTotalChange,
  shares,
  onSharesChange,
  colleagues,
  children,
}: {
  creatorName: string;
  commissionTotal: number;
  onCommissionTotalChange: (value: number) => void;
  shares: ColleagueShare[];
  onSharesChange: (shares: ColleagueShare[]) => void;
  colleagues: StaffColleague[];
  children?: ReactNode;
}) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    function onPointer(event: MouseEvent) {
      if (pickerRef.current?.contains(event.target as Node)) return;
      setOpenId(null);
      setQuery("");
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenId(null);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  function updateShare(index: number, patch: Partial<ColleagueShare>) {
    onSharesChange(shares.map((share, i) => (i === index ? { ...share, ...patch } : share)));
  }

  function personLabel(code: string) {
    const person = colleagues.find((item) => item.code === code);
    if (!person) return code;
    const sharedNickname = colleagues.filter((other) => other.nickname === person.nickname).length > 1;
    return sharedNickname ? `${person.nickname} · ${person.code}` : person.nickname;
  }

  const percentTotal = shares.reduce((sum, share) => sum + (Number(share.value) > 0 ? Number(share.value) : 0), 0);
  const over = percentTotal > 100;
  const keptPercent = Math.max(0, Math.round((100 - percentTotal) * 10) / 10);
  const keptAmount = (commissionTotal * keptPercent) / 100;
  const keeper = creatorName.trim();
  const slices = [
    ...(!over && keptPercent > 0 && keeper ? [{ name: keeper, percent: keptPercent, color: "rgb(var(--color-brand-500))" }] : []),
    ...shares.flatMap((share, index) => {
      const percent = Number(share.value) || 0;
      if (!(percent > 0) || !share.colleagueName) return [];
      return [{ name: personLabel(share.colleagueName), percent, color: PARTNER_COLORS[index % PARTNER_COLORS.length] }];
    }),
  ];
  const scale = over ? Math.max(percentTotal, 0.1) : 100;

  return (
    <details className="card group overflow-visible" open>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold text-ink">{t("Commission")}</span>
        <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{formatCurrency(commissionTotal)}</span>
        <ChevronDown size={16} className="text-ink-muted transition-transform group-open:rotate-180" />
      </summary>

      <div className="flex flex-col gap-3 px-5 pb-5">
        <label className="flex max-w-[180px] items-center gap-1.5 rounded-xl border border-line bg-paper px-3 py-1.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
          <span className="text-sm font-semibold text-ink-muted">HK$</span>
          <input
            id="commission-total"
            className="w-full border-0 bg-transparent text-base font-semibold text-ink outline-none"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            aria-label={t("Total commission")}
            value={Number.isFinite(commissionTotal) ? commissionTotal : 0}
            onChange={(e) => onCommissionTotalChange(Number(e.target.value))}
          />
        </label>

        <div
          className={`flex h-2 overflow-hidden rounded-full bg-line ${over ? "ring-1 ring-danger-500" : ""}`}
          role="img"
          aria-label={t("Commission")}
        >
          {slices.map((slice, index) => (
            <span key={`${slice.name}-${index}`} style={{ width: `${(slice.percent / scale) * 100}%`, background: slice.color }} />
          ))}
        </div>
        {slices.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {slices.map((slice, index) => (
              <span key={`${slice.name}-legend-${index}`} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: slice.color }} />
                {slice.name} {slice.percent}%
              </span>
            ))}
          </div>
        )}

        {over ? <p className="text-sm text-danger-600">{t("Partner percentages can't add up to more than 100.")}</p> : null}

        {keeper ? (
          <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-2.5 py-2">
            <span
              className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[11px] font-extrabold text-white"
              style={{ background: "rgb(var(--color-brand-500))" }}
            >
              {initials(keeper)}
            </span>
            <span className="min-w-0 truncate text-sm font-semibold text-ink">{keeper}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{formatCurrency(over ? 0 : keptAmount)}</span>
            <span className="w-12 text-right text-sm tabular-nums text-ink-muted">{over ? "0" : keptPercent}%</span>
          </div>
        ) : null}

        {shares.map((share, index) => {
          const amount = (commissionTotal * (Number(share.value) || 0)) / 100;
          const name = share.colleagueName ? personLabel(share.colleagueName) : "";
          const color = PARTNER_COLORS[index % PARTNER_COLORS.length];
          return (
            <div key={share.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-2.5 py-2">
              <span
                className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[11px] font-extrabold text-white"
                style={{ background: name ? color : "rgb(var(--color-ink-faint))" }}
              >
                {initials(name) || "–"}
              </span>
              <ColleaguePicker
                share={share}
                colleagues={colleagues}
                open={openId === share.id}
                query={openId === share.id ? query : ""}
                pickerRef={openId === share.id ? pickerRef : undefined}
                onQueryChange={setQuery}
                onToggle={() => {
                  setOpenId((current) => (current === share.id ? null : share.id));
                  setQuery("");
                }}
                onChoose={(code) => {
                  updateShare(index, { colleagueName: code });
                  setOpenId(null);
                  setQuery("");
                }}
                labelFor={personLabel}
              />
              <span className="min-w-[5.5rem] text-right text-sm tabular-nums text-ink-muted">{formatCurrency(amount)}</span>
              <label className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5">
                <input
                  className="w-12 border-0 bg-transparent text-right text-sm font-semibold tabular-nums text-ink outline-none"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  inputMode="decimal"
                  aria-label={t("Percent of commission")}
                  value={Number.isFinite(share.value) ? share.value : 0}
                  onChange={(e) => updateShare(index, { value: Number(e.target.value) })}
                />
                <span className="text-xs text-ink-faint">%</span>
              </label>
              <button
                type="button"
                className="text-ink-faint hover:text-danger-500"
                aria-label={t("Remove colleague")}
                onClick={() => onSharesChange(shares.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}

        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onSharesChange([...shares, emptyColleagueShare()])}
          >
            <Plus size={15} /> {t("Add colleague")}
          </button>
        </div>
        {children}
      </div>
    </details>
  );
}
