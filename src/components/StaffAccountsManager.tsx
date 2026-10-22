"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type StaffCategory = "HR_PLUS_STAFF" | "FULL_TIME" | "PART_TIME" | "FREELANCE";
type StaffLabel = "ADMIN" | "MEMBER" | "EXTERNAL_ADMIN" | "EXTERNAL_MEMBER";

const CATEGORIES: StaffCategory[] = ["HR_PLUS_STAFF", "FULL_TIME", "PART_TIME", "FREELANCE"];
const LABELS: StaffLabel[] = ["ADMIN", "MEMBER", "EXTERNAL_ADMIN", "EXTERNAL_MEMBER"];

const CATEGORY_TEXT: Record<StaffCategory, string> = {
  HR_PLUS_STAFF: "HR Plus staff",
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  FREELANCE: "Freelance",
};

const LABEL_TEXT: Record<StaffLabel, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
  EXTERNAL_ADMIN: "External admin",
  EXTERNAL_MEMBER: "External member",
};

const emptyDraft = {
  email: "",
  name: "",
  category: "HR_PLUS_STAFF" as StaffCategory,
  label: "MEMBER" as StaffLabel,
  companyName: "",
};

export default function StaffAccountsManager() {
  const t = useT();
  const [companies, setCompanies] = useState<string[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/employer-companies")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const names = Array.isArray(data) ? data.map((company: { name?: string }) => company.name || "").filter(Boolean) : [];
        setCompanies(names);
      })
      .catch(() => setCompanies([]));
  }, []);

  async function addAccount() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add the account.");
      setDraft(emptyDraft);
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const external = draft.label === "EXTERNAL_ADMIN" || draft.label === "EXTERNAL_MEMBER";

  return (
    <div className="card p-5 flex flex-col gap-4 max-w-3xl">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Add a person")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(
            "Add their Google Workspace email so they can sign in. They choose their own nickname from Settings after they log in."
          )}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
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
            onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">{t("Google Workspace email")}</label>
          <input
            type="email"
            className="input"
            placeholder="jamie@company.com"
            value={draft.email}
            onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">{t("Payroll category")}</label>
          <select
            className="input"
            value={draft.category}
            onChange={(e) => setDraft((current) => ({ ...current, category: e.target.value as StaffCategory }))}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(CATEGORY_TEXT[category])}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{t("Role")}</label>
          <select
            className="input"
            value={draft.label}
            onChange={(e) => setDraft((current) => ({ ...current, label: e.target.value as StaffLabel }))}
          >
            {LABELS.map((label) => (
              <option key={label} value={label}>
                {t(LABEL_TEXT[label])}
              </option>
            ))}
          </select>
        </div>
        {external && (
          <div>
            <label className="label">{t("Their company")}</label>
            {companies.length > 0 ? (
              <select
                className="input"
                value={draft.companyName}
                onChange={(e) => setDraft((current) => ({ ...current, companyName: e.target.value }))}
              >
                <option value="">{t("Their company")}</option>
                {companies.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={draft.companyName}
                onChange={(e) => setDraft((current) => ({ ...current, companyName: e.target.value }))}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={addAccount} disabled={saving || !draft.email.trim()} className="btn-secondary self-start">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {t("Add account")}
        </button>
        {saved && <span className="text-sm text-emerald-600">{t("Saved")}</span>}
      </div>
    </div>
  );
}
