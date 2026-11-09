"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

export default function MpfDoneClient({ token, alreadyDone }: { token: string; alreadyDone: boolean }) {
  const t = useT();
  const [done, setDone] = useState(alreadyDone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/public/mpf/${token}/done`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error || t("Could not save the file. Please try again."));
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="mt-5 text-sm font-medium text-emerald-700">{t("eMPF registration is done.")}</p>;
  }

  return (
    <div className="mt-5">
      <button type="button" className="btn-primary" disabled={busy} onClick={finish}>
        {busy ? t("Saving…") : t("I have finished eMPF registration")}
      </button>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
