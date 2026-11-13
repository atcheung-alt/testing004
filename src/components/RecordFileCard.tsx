"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecordFileCard({
  kind,
  id,
  fileName,
  fileUrl,
}: {
  kind: "invoice" | "recruitment";
  id: string;
  fileName: string | null;
  fileUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = kind === "invoice" ? `/api/invoices/${id}/record` : `/api/recruitment/${id}/record`;

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(url, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The file could not be saved.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg font-semibold">Client&apos;s signed file</h2>
      <p className="text-sm text-ink-muted mt-1">
        {fileUrl
          ? "This file is in the Signed records folder. Open it to read it. Choose another file if this one should be replaced."
          : "The client signed on paper, or sent a file, instead of signing on this page. Save that file here. It is kept in the Signed records folder."}
      </p>
      {fileUrl && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3">
          Open {fileName || "file"}
        </a>
      )}
      <label className="btn-secondary mt-3 cursor-pointer">
        {busy ? "Saving…" : fileUrl ? "Replace with another file" : "Save the client's file"}
        <input
          type="file"
          className="hidden"
          disabled={busy}
          onChange={(event) => upload(event.target.files?.[0])}
        />
      </label>
      {error && <p className="text-sm text-danger-600 mt-2">{error}</p>}
    </div>
  );
}
