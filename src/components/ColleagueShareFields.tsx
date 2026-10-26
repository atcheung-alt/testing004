"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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
  const keeper = creatorName || t("Not set");
  const slices = [
    ...(!over && keptPercent > 0 ? [{ name: keeper, percent: keptPercent, color: "rgb(var(--color-brand-500))" }] : []),
    ...shares.flatMap((share, index) => {
      const percent = Number(share.value) || 0;
      if (!(percent > 0) || !share.colleagueName) return [];
      return [{ name: personLabel(share.colleagueName), percent, color: PARTNER_COLORS[index % PARTNER_COLORS.length] }];
    }),
  ];
  const scale = over ? Math.max(percentTotal, 0.1) : 100;

  return (
    <details className="card group" open>
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

        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-2.5 py-2">
          <span
            className="grid h-7 w-7 flex-none place-items-center rounded-lg text-[11px] font-extrabold text-white"
            style={{ background: "rgb(var(--color-brand-500))" }}
          >
            {initials(keeper) || "–"}
          </span>
          <span className="min-w-0 truncate text-sm font-semibold text-ink">{keeper}</span>
          <span className="ml-auto text-sm font-semibold tabular-nums text-ink">{formatCurrency(over ? 0 : keptAmount)}</span>
          <span className="w-12 text-right text-sm tabular-nums text-ink-muted">{over ? "0" : keptPercent}%</span>
        </div>

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
              <select
                className="input min-w-[9rem] flex-1 py-1.5"
                value={share.colleagueName}
                onChange={(e) => updateShare(index, { colleagueName: e.target.value })}
                aria-label={t("Colleague")}
              >
                <option value="">{t("Choose a colleague")}</option>
                {colleagues.map((person) => {
                  const sharedNickname = colleagues.filter((other) => other.nickname === person.nickname).length > 1;
                  return (
                    <option key={person.code} value={person.code}>
                      {sharedNickname ? `${person.nickname} · ${person.code}` : person.nickname}
                    </option>
                  );
                })}
                {share.colleagueName && !colleagues.some((person) => person.code === share.colleagueName) && (
                  <option value={share.colleagueName}>{share.colleagueName}</option>
                )}
              </select>
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
