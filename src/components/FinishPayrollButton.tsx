"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export default function FinishPayrollButton({ runId, ready, done }: { runId: string; ready: boolean; done: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function finish() {
    if (!ready || done || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FINALIZED" }),
      });
      if (!res.ok) return;
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-primary" disabled={!ready || done || busy} onClick={finish}>
      {done ? t("Payroll finished") : t("Finish this payroll")}
    </button>
  );
}
