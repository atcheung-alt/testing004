"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function MpfUploadClient({ token, saved }: { token: string; saved: boolean }) {
  const t = useT();
  const [done, setDone] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    }).catch((err: Error) => {
      setError(err.message);
      return "";
    });
    if (!data) {
      setBusy(false);
      return;
    }
    const res = await fetch(`/api/public/mpf/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || t("Could not save the file. Please try again."));
      return;
    }
    setFileName(file.name);
    setDone(true);
  }

  return (
    <div className="mt-5">
      <label className={`btn-primary ${busy ? "opacity-60" : ""}`}>
        {busy ? t("Saving…") : t("Upload signed Individual eMPF Form")}
        <input
          className="hidden"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy}
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </label>
      {fileName && <p className="mt-3 text-sm text-ink-muted">{fileName}</p>}
      {done && <p className="mt-3 text-sm font-medium text-emerald-700">{t("Saved. HR Plus can open it from the MPF page.")}</p>}
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
