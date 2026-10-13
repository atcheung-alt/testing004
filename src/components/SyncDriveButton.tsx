"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useAppLanguage, useT } from "@/lib/i18n/client";
import { appLanguageToPdf } from "@/lib/i18n/language";
import type { PdfDownloadLanguage } from "@/lib/pdf/language";

export default function SyncDriveButton({ invoiceId }: { invoiceId: string }) {
  const t = useT();
  const router = useRouter();
  const appLanguage = useAppLanguage();
  const [busy, setBusy] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<PdfDownloadLanguage>(appLanguageToPdf(appLanguage));
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/sync-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not sync to Google Drive.");
      setMessage(data.warning || "Synced successfully.");
      router.refresh();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="inline-flex items-stretch rounded-md border border-line bg-surface overflow-hidden">
        {(
          [
            ["EN", "English"],
            ["ZH_HANT", "中文"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPdfLanguage(value)}
            className={`px-2.5 py-2 text-sm font-medium transition-colors ${
              pdfLanguage === value ? "bg-brand-600 text-white" : "text-ink hover:bg-paper"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleSync}
          disabled={busy}
          className="inline-flex items-center gap-2 border-l border-line px-3 py-2 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {busy ? t("Syncing…") : t("Sync to Drive now")}
        </button>
      </div>
      {message && <span className="text-xs text-ink-muted max-w-md">{t(message)}</span>}
    </div>
  );
}
