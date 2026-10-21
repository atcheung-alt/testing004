"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function RequestAccessForm({
  initialEmail = "",
  initialName = "",
}: {
  initialEmail?: string;
  initialName?: string;
}) {
  const t = useT();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [companyName, setCompanyName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, companyName, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the request.");
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6 flex flex-col gap-3">
        <CheckCircle2 className="text-brand-500" size={22} />
        <h1 className="font-display text-xl font-semibold text-ink">{t("Request sent")}</h1>
        <p className="text-sm text-ink-muted">
          {t("An admin will set your access on the Management page. Sign in with Google again after they approve this email.")}
        </p>
        <Link href="/login" className="btn-secondary self-start">
          {t("Back to log in")}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="card p-6 flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">{t("Request access")}</h1>
        <p className="text-sm text-ink-muted mt-1">
          {t("This Google account cannot sign in yet. Send your email and company, and an admin will approve it from Management.")}
        </p>
      </div>
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}
      <div>
        <label className="label">{t("Email")}</label>
        <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div>
        <label className="label">{t("Name")}</label>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div>
        <label className="label">{t("Company")}</label>
        <input className="input" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
      </div>
      <div>
        <label className="label">{t("What you need access for")}</label>
        <textarea className="input min-h-[5rem]" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      <button type="submit" className="btn-primary justify-center" disabled={saving || !email.trim()}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
        {t("Send request")}
      </button>
      <Link href="/login" className="text-sm text-ink-muted text-center">
        {t("Back to log in")}
      </Link>
    </form>
  );
}
