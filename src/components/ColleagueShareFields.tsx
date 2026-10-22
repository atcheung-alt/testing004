"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";
import type { StaffColleague } from "@/lib/staffCode";

export type ColleagueShare = {
  id: string;
  colleagueName: string;
  value: number;
};

export function emptyColleagueShare(colleagueName = "", value = 0): ColleagueShare {
  return { id: Math.random().toString(36).slice(2), colleagueName, value };
}

export default function ColleagueShareFields({
  creatorName,
  commissionTotal,
  onCommissionTotalChange,
  shares,
  onSharesChange,
  colleagues,
}: {
  creatorName: string;
  commissionTotal: number;
  onCommissionTotalChange: (value: number) => void;
  shares: ColleagueShare[];
  onSharesChange: (shares: ColleagueShare[]) => void;
  colleagues: StaffColleague[];
}) {
  const t = useT();

  function updateShare(index: number, patch: Partial<ColleagueShare>) {
    onSharesChange(shares.map((share, i) => (i === index ? { ...share, ...patch } : share)));
  }

  const percentTotal = shares.reduce((sum, share) => sum + (Number(share.value) > 0 ? Number(share.value) : 0), 0);
  const keptPercent = Math.max(0, Math.round((100 - percentTotal) * 10) / 10);
  const keptAmount = (commissionTotal * keptPercent) / 100;
  const keeper = creatorName || t("Made by");

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Split commission")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(
            "Enter the commission total, then each partner's percentage. The rest stays with the person who created the invoice. If you add no one, the whole amount is theirs. A partner only sees their own amount."
          )}
        </p>
      </div>

      <div className="max-w-xs">
        <p className="label">{t("Made by")}</p>
        <p className="text-sm font-medium text-ink">{creatorName || t("Not set")}</p>
      </div>

      <div className="max-w-xs">
        <label className="label" htmlFor="commission-total">
          {t("Total commission")}
        </label>
        <input
          id="commission-total"
          className="input"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={Number.isFinite(commissionTotal) ? commissionTotal : 0}
          onChange={(e) => onCommissionTotalChange(Number(e.target.value))}
        />
      </div>

      <div className="flex flex-col gap-2">
        {shares.map((share, index) => {
          const amount = (commissionTotal * (Number(share.value) || 0)) / 100;
          return (
            <div key={share.id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
              <div>
                {index === 0 && <label className="label">{t("Colleague")}</label>}
                <select
                  className="input"
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
              </div>
              <div>
                {index === 0 && <label className="label">{t("Percent of commission")}</label>}
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  inputMode="decimal"
                  aria-label={t("Percent of commission")}
                  value={Number.isFinite(share.value) ? share.value : 0}
                  onChange={(e) => updateShare(index, { value: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <span className="text-sm text-ink-muted font-mono min-w-[5.5rem]">{formatCurrency(amount)}</span>
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
        <p className="text-sm text-ink">
          {percentTotal > 100
            ? t("Partner percentages can't add up to more than 100.")
            : keptPercent === 100
              ? t("{name} keeps the whole commission · {amount}", {
                  name: keeper,
                  amount: formatCurrency(keptAmount),
                })
              : t("{name} keeps {percent}% · {amount}", {
                  name: keeper,
                  percent: String(keptPercent),
                  amount: formatCurrency(keptAmount),
                })}
        </p>
      </div>
    </div>
  );
}
