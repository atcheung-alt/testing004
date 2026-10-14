"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function AdminCodeForm() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("That security code is wrong."));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 max-w-sm flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{t("Security code")}</h2>
        <p className="text-sm text-ink-muted mt-1">{t("Enter the security code to open the admin page.")}</p>
      </div>
      {error && <p className="text-sm text-danger-500">{t(error)}</p>}
      <div>
        <label className="label">{t("Security code")}</label>
        <input
          className="input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary justify-center" disabled={saving || code.trim().length === 0}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
        {t("Open admin page")}
      </button>
    </form>
  );
}
