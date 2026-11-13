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
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = kind === "invoice" ? `/api/invoices/${id}/record` : `/api/recruitment/${id}/record`;
  const place = kind === "invoice" ? "this invoice" : "this recruitment agreement";
  const shownName = fileName || "file";

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

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "The file could not be deleted.");
      setConfirming(false);
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
          ? "This file is in the Signed records folder. Open it to read it. Replacing it deletes the previous file in Drive. Delete removes it from this page and from Drive."
          : "The client signed on paper, or sent a file, instead of signing on this page. Save that file here. It is kept in the Signed records folder."}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            Open {shownName}
          </a>
        )}
        <label className="btn-secondary cursor-pointer">
          {busy ? "Saving…" : fileUrl ? "Replace with another file" : "Save the client's file"}
          <input
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0])}
          />
        </label>
        {fileUrl && (
          <button type="button" className="btn-secondary text-danger-600" disabled={busy} onClick={() => setConfirming(true)}>
            Delete this file
          </button>
        )}
      </div>
      {error && <p className="text-sm text-danger-600 mt-2">{error}</p>}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4">
          <div className="card p-5 max-w-md w-full">
            <h3 className="font-display text-lg font-semibold">Delete this file?</h3>
            <p className="text-sm text-ink-muted mt-1">
              {shownName} will be removed from {place} and deleted from the Signed records folder.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>
                Keep the file
              </button>
              <button type="button" className="btn-secondary text-danger-600" disabled={busy} onClick={remove}>
                {busy ? "Deleting…" : "Delete the file"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
