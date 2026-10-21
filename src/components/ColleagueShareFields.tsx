"use client";

import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";

export type ShareMode = "AMOUNT" | "PERCENT";

export type ColleagueShare = {
  id: string;
  colleagueName: string;
  value: number;
};

export function emptyColleagueShare(colleagueName = "", value = 0): ColleagueShare {
  return { id: Math.random().toString(36).slice(2), colleagueName, value };
}

export default function ColleagueShareFields({
  preparedBy,
  onPreparedByChange,
  shareMode,
  onShareModeChange,
  shares,
  onSharesChange,
  total,
  colleagueNames,
}: {
  preparedBy: string;
  onPreparedByChange: (value: string) => void;
  shareMode: ShareMode;
  onShareModeChange: (value: ShareMode) => void;
  shares: ColleagueShare[];
  onSharesChange: (shares: ColleagueShare[]) => void;
  total: number;
  colleagueNames: string[];
}) {
  const t = useT();
  const listId = "colleague-name-suggestions";

  function updateShare(index: number, patch: Partial<ColleagueShare>) {
    onSharesChange(shares.map((share, i) => (i === index ? { ...share, ...patch } : share)));
  }

  const percentTotal = shares.reduce((sum, share) => sum + (Number(share.value) || 0), 0);
  const amountTotal = shares.reduce((sum, share) => sum + (Number(share.value) || 0), 0);

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Made by & colleague sharing")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t("Made by defaults to your nickname. Add colleagues and share either an exact amount or a percentage of the quotation total.")}
        </p>
      </div>

      <div className="max-w-xs">
        <label className="label" htmlFor="prepared-by">
          {t("Made by")}
        </label>
        <input
          id="prepared-by"
          className="input"
          list={listId}
          value={preparedBy}
          onChange={(e) => onPreparedByChange(e.target.value)}
          placeholder={t("e.g. AT")}
        />
      </div>

      <div className="inline-flex flex-wrap rounded-full border border-line bg-paper p-1 gap-1 self-start">
        {(
          [
            ["AMOUNT", "Exact amount"],
            ["PERCENT", "Percentage of total"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={shareMode === value}
            onClick={() => onShareModeChange(value)}
            className={clsx(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              shareMode === value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <datalist id={listId}>
        {colleagueNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="flex flex-col gap-2">
        {shares.map((share, index) => {
          const computed =
            shareMode === "PERCENT" ? (total * (Number(share.value) || 0)) / 100 : Number(share.value) || 0;
          return (
            <div key={share.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div>
                {index === 0 && <label className="label">{t("Colleague")}</label>}
                <input
                  className="input"
                  list={listId}
                  value={share.colleagueName}
                  placeholder={t("Nickname")}
                  onChange={(e) => updateShare(index, { colleagueName: e.target.value })}
                />
              </div>
              <div>
                {index === 0 && (
                  <label className="label">{shareMode === "PERCENT" ? t("Percent") : t("Amount")}</label>
                )}
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={shareMode === "PERCENT" ? 100 : undefined}
                  step={shareMode === "PERCENT" ? "0.1" : "0.01"}
                  value={Number.isFinite(share.value) ? share.value : 0}
                  onChange={(e) => updateShare(index, { value: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <span className="text-sm text-ink-muted font-mono min-w-[5.5rem]">
                  {shareMode === "PERCENT" ? formatCurrency(computed) : ""}
                </span>
                <button
                  type="button"
                  className="text-ink-faint hover:text-danger-500"
                  aria-label={t("Remove colleague")}
                  onClick={() => onSharesChange(shares.filter((_, i) => i !== index))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onSharesChange([...shares, emptyColleagueShare()])}
        >
          <Plus size={15} /> {t("Add colleague")}
        </button>
        <p className="text-xs text-ink-muted">
          {shareMode === "PERCENT"
            ? t("Percentages add up to {percent}%.", { percent: Math.round(percentTotal * 10) / 10 })
            : t("Amounts add up to {amount}.", { amount: formatCurrency(amountTotal) })}
          {shareMode === "PERCENT" && percentTotal > 100 ? ` ${t("That is over 100%.")}` : ""}
        </p>
      </div>
    </div>
  );
}
