"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommissionPaidToggle({
  invoiceId,
  colleagueName,
  paid,
  paidLabel,
  unpaidLabel,
  markLabel,
  undoLabel,
  markQuestion,
  undoQuestion,
  confirmLabel,
  cancelLabel,
}: {
  invoiceId: string;
  colleagueName: string;
  paid: boolean;
  paidLabel: string;
  unpaidLabel: string;
  markLabel: string;
  undoLabel: string;
  markQuestion: string;
  undoQuestion: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  async function save() {
    setBusy(true);
    await fetch("/api/commission-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, colleagueName, paid: !paid }),
    });
    setBusy(false);
    setAsk(false);
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`stamp ${paid ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-line text-ink-muted"}`}>
        {paid ? paidLabel : unpaidLabel}
      </span>
      {ask ? (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs text-ink">
          <span>{paid ? undoQuestion : markQuestion}</span>
          <button type="button" disabled={busy} className="rounded-full border border-brand-500 px-2 py-0.5 text-brand-600" onClick={save}>
            {confirmLabel}
          </button>
          <button type="button" disabled={busy} className="rounded-full border border-line px-2 py-0.5 text-ink-muted" onClick={() => setAsk(false)}>
            {cancelLabel}
          </button>
        </span>
      ) : (
        <button type="button" className="text-xs text-ink-muted underline underline-offset-2" onClick={() => setAsk(true)}>
          {paid ? undoLabel : markLabel}
        </button>
      )}
    </span>
  );
}
