"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ReceiptText } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function ClientInvoiceButton({
  runId,
  companyId,
  invoiceId,
}: {
  runId: string;
  companyId: string;
  invoiceId?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState(invoiceId || "");

  async function createInvoice() {
    if (busy) return;
    if (openedId) {
      router.push(`/invoices/${openedId}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/${runId}/client-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the client invoice.");
      setOpenedId(data.id);
      router.push(`/invoices/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className="btn-secondary" onClick={createInvoice} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ReceiptText size={15} />}
        {openedId ? t("Open client invoice") : t("Bill this client")}
      </button>
      {error && <p className="text-xs text-danger-600">{t(error)}</p>}
    </div>
  );
}
