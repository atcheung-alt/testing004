"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function ContractDriveUpload({
  employeeId,
  fileUrl,
}: {
  employeeId: string;
  fileUrl?: string | null;
}) {
  const t = useT();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(fileUrl || "");
  const [error, setError] = useState("");

  async function save(file: File | null | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/employees/${employeeId}/contract-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save the file.");
      setUrl(body.url || url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
      setOver(false);
    }
  }

  return (
    <div className="mt-4">
      <label
        className={`block cursor-pointer rounded-xl border border-dashed px-3 py-4 text-center text-sm text-ink-muted ${over ? "border-brand-500 text-brand-600" : "border-line"}`}
        onDragEnter={(event) => { event.preventDefault(); setOver(true); }}
        onDragOver={(event) => { event.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => { event.preventDefault(); void save(event.dataTransfer.files && event.dataTransfer.files[0]); }}
      >
        {busy ? t("Saving…") : t("Drop the contract here, or click to choose a file")}
        <input className="hidden" type="file" accept="image/*,.pdf" onChange={(event) => void save(event.target.files && event.target.files[0])} />
      </label>
      {url ? <a className="mt-2 inline-block text-sm text-brand-600" href={url} target="_blank" rel="noreferrer">{t("Open Contract file")}</a> : null}
      {error ? <p className="mt-2 text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
