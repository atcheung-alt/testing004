"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, AlertCircle, UserCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type StaffAccount = {
  id: string;
  email: string;
  name: string;
};

const emptyDraft = { email: "", name: "" };

export default function StaffAccountsManager() {
  const t = useT();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function addAccount() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add the account.");
      setDraft(emptyDraft);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAccount(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove the account.");
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4 max-w-2xl">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Staff accounts")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(
            "Who can log in — everyone signs in with their Google Workspace account, so just add their work email below. There's no password to set; the first sign-in with that email creates their session automatically."
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">{t("Loading…")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <UserCircle2 size={16} className="text-ink-faint shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{a.name || a.email}</p>
                  <p className="text-xs text-ink-faint truncate">{a.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAccount(a.id)}
                disabled={deletingId === a.id}
                aria-label={t("Remove {name}", { name: a.email })}
                className="text-ink-faint hover:text-danger-500 transition-colors shrink-0"
              >
                {deletingId === a.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="label">{t("Name (optional)")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("Jamie Tan")}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">{t("Google Workspace email")}</label>
          <input
            type="email"
            className="input"
            placeholder="jamie@company.com"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={addAccount}
        disabled={saving || !draft.email.trim()}
        className="btn-secondary self-start"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {t("Add account")}
      </button>
    </div>
  );
}
