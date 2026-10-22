"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";
import type { StaffColleague } from "@/lib/staffCode";
import { colleagueLabel } from "@/lib/staffCode";
import ColleagueShareFields, {
  emptyColleagueShare,
  type ColleagueShare,
  type ShareMode,
} from "@/components/ColleagueShareFields";

export default function QuotationShareEditor({
  quotationId,
  canEdit,
  preparedBy: initialPreparedBy,
  shareMode: initialShareMode,
  shares: initialShares,
  total,
  colleagues,
}: {
  quotationId: string;
  canEdit: boolean;
  preparedBy: string;
  shareMode: ShareMode;
  shares: { colleagueName: string; value: number }[];
  total: number;
  colleagues: StaffColleague[];
}) {
  const t = useT();
  const router = useRouter();
  const [preparedBy, setPreparedBy] = useState(initialPreparedBy);
  const [shareMode, setShareMode] = useState<ShareMode>(initialShareMode);
  const [shares, setShares] = useState<ColleagueShare[]>(
    initialShares.length
      ? initialShares.map((share) => emptyColleagueShare(share.colleagueName, share.value))
      : [emptyColleagueShare()]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    if (!initialPreparedBy && initialShares.length === 0) return null;
    return (
      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-3">{t("Split commission")}</h2>
        {initialPreparedBy && (
          <p className="text-sm text-ink mb-3">{t("Made by {name}", { name: initialPreparedBy })}</p>
        )}
        {initialShares.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-ink-faint">
              {initialShareMode === "PERCENT" ? t("Percentage of total") : t("Exact amount")}
            </p>
            {initialShares.map((share, index) => {
              const amount = initialShareMode === "PERCENT" ? (total * share.value) / 100 : share.value;
              return (
                <div key={`${share.colleagueName}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{colleagueLabel(share.colleagueName, colleagues)}</span>
                  <span className="font-mono text-ink-muted">
                    {initialShareMode === "PERCENT" ? `${share.value}% · ${formatCurrency(amount)}` : formatCurrency(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharesOnly: true,
          preparedBy,
          shareMode,
          shares: shares.map((share) => ({ colleagueName: share.colleagueName, value: share.value })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the split.");
      setSaved(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ColleagueShareFields
        preparedBy={preparedBy}
        onPreparedByChange={setPreparedBy}
        shareMode={shareMode}
        onShareModeChange={setShareMode}
        shares={shares}
        onSharesChange={(next) => {
          setSaved(false);
          setShares(next);
        }}
        total={total}
        colleagues={colleagues}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : null}
          {saving ? t("Saving split…") : t("Save split")}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> {t("Split saved")}
          </span>
        )}
        {error && <p className="text-sm text-danger-600">{t(error)}</p>}
      </div>
    </div>
  );
}
