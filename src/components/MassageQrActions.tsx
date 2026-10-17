"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function MassageQrActions({ url, pngDataUrl }: { url: string; pngDataUrl: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted break-all font-mono">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? t("Link copied") : t("Copy link")}
        </button>
        <a className="btn-secondary" href={pngDataUrl} download="massage-survey-qr.png">
          {t("Download QR")}
        </a>
      </div>
    </div>
  );
}
