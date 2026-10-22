"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";
import type { StaffColleague } from "@/lib/staffCode";
import ColleagueShareFields, { emptyColleagueShare, type ColleagueShare } from "@/components/ColleagueShareFields";

export default function QuotationShareEditor({
  invoiceId,
  canEdit,
  creatorName,
  commissionTotal: initialTotal,
  shares: initialShares,
  ownAmount = 0,
  colleagues,
}: {
  invoiceId: string;
  canEdit: boolean;
  creatorName: string;
  commissionTotal: number;
  shares: { colleagueName: string; value: number }[];
  ownAmount?: number;
  colleagues: StaffColleague[];
}) {
  const t = useT();
  const router = useRouter();
  const [commissionTotal, setCommissionTotal] = useState(initialTotal);
  const [shares, setShares] = useState<ColleagueShare[]>(
    initialShares.length
      ? initialShares.map((share) => emptyColleagueShare(share.colleagueName, share.value))
      : [emptyColleagueShare(), emptyColleagueShare()]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    if (!(ownAmount > 0)) return null;
    return (
      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-2">{t("Split commission")}</h2>
        <p className="text-sm text-ink">
          {t("Your commission")} · {formatCurrency(ownAmount)}
        </p>
      </div>
    );
  }

  async function save() {
    const assigned = shares.reduce((sum, share) => sum + (Number(share.value) > 0 ? Number(share.value) : 0), 0);
    if (assigned > 100) {
      setError("Partner percentages can't add up to more than 100.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/share`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionTotal,
          shares: shares.map((share) => ({ colleagueName: share.colleagueName, value: share.value })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the split.");
      setSaved(true);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the split.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ColleagueShareFields
        creatorName={creatorName}
        commissionTotal={commissionTotal}
        onCommissionTotalChange={(next) => {
          setSaved(false);
          setCommissionTotal(next);
        }}
        shares={shares}
        onSharesChange={(next) => {
          setSaved(false);
          setShares(next);
        }}
        colleagues={colleagues}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : null}
          {saving ? t("Saving split…") : t("Save split")}
        </button>
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> {t("Split saved")}
          </span>
        ) : null}
        {error ? <p className="text-sm text-danger-600">{t(error)}</p> : null}
      </div>
    </div>
  );
}
