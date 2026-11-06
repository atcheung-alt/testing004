"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CommissionPaidToggle({
  invoiceId,
  colleagueName,
  paid,
  paidDay,
  paidWord,
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
  paidDay: string;
  paidWord: string;
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
  const [isPaid, setIsPaid] = useState(paid);
  const [paidOn, setPaidOn] = useState(paidDay);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsPaid(paid);
    setPaidOn(paidDay);
  }, [paid, paidDay]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commission-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, colleagueName, paid: !isPaid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not update this billing.");
      setIsPaid(Boolean(payload.paid));
      setPaidOn(typeof payload.paidOn === "string" ? payload.paidOn : "");
      setAsk(false);
      router.refresh();
    } catch (err) {
      setAsk(false);
      setError(err instanceof Error ? err.message : "Could not update this billing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`stamp ${isPaid ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-line text-ink-muted"}`}>
        {isPaid ? `${paidWord} ${paidOn || ""}`.trim() : unpaidLabel}
      </span>
      {ask ? (
        <span className="inline-flex flex-wrap items-center gap-1 text-xs text-ink">
          <span>{isPaid ? undoQuestion : markQuestion}</span>
          <button type="button" disabled={busy} className="rounded-full border border-brand-500 px-2 py-0.5 text-brand-600" onClick={save}>
            {confirmLabel}
          </button>
          <button type="button" disabled={busy} className="rounded-full border border-line px-2 py-0.5 text-ink-muted" onClick={() => setAsk(false)}>
            {cancelLabel}
          </button>
        </span>
      ) : (
        <button type="button" className="text-xs text-ink-muted underline underline-offset-2" onClick={() => setAsk(true)}>
          {isPaid ? undoLabel : markLabel}
        </button>
      )}
      {error ? <span role="alert" className="text-xs text-danger-500">{error}</span> : null}
    </span>
  );
}
