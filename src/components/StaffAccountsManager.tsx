"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, AlertCircle, UserCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type StaffCategory = "HR_PLUS_STAFF" | "FULL_TIME" | "PART_TIME" | "FREELANCE";
type StaffLabel = "ADMIN" | "MEMBER" | "EXTERNAL_ADMIN" | "EXTERNAL_MEMBER";

type StaffAccount = {
  id: string;
  email: string;
  name: string;
  nickname: string;
  category: StaffCategory | null;
  label: StaffLabel | null;
  companyName: string;
};

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
  nickname: "",
  category: "HR_PLUS_STAFF" as StaffCategory,
  label: "MEMBER" as StaffLabel,
  companyName: "",
};

export default function StaffAccountsManager() {
  const t = useT();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  function load() {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setAccounts(rows);
        setNicknames(Object.fromEntries(rows.map((row: StaffAccount) => [row.id, row.nickname || ""])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
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

  async function patchAccount(account: StaffAccount, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/users/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the account.");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveNickname(account: StaffAccount) {
    const nickname = nicknames[account.id] ?? "";
    if (nickname === (account.nickname || "")) return;
    await patchAccount(account, { nickname });
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

  const groups: { key: string; title: string }[] = [
    ...CATEGORIES.map((category) => ({ key: category, title: CATEGORY_TEXT[category] })),
    { key: "UNSET", title: "Not categorized yet" },
  ];

  return (
    <div className="card p-5 flex flex-col gap-4 max-w-3xl">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Staff Accounts")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(
            "Who can log in — everyone signs in with their Google Workspace account, so just add their work email below. There's no password to set; the first sign-in with that email creates their session automatically."
          )}
        </p>
        <p className="text-sm text-ink-muted mt-2">
          {t(
            "HR Plus staff, full-time, part-time, and freelance each show in their own payroll section. Freelance accounts only see quotations, invoices, and files they created, or ones an admin listed their email on. External admin sees only their company's workers. External member sees only their own worker record."
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
        <div className="flex flex-col gap-5">
          {groups.map((group) => {
            const rows = accounts.filter((account) => (account.category || "UNSET") === group.key);
            if (rows.length === 0) return null;
            return (
              <div key={group.key} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-ink">{t(group.title)}</h3>
                <div className="flex flex-col divide-y divide-line">
                  {rows.map((account) => {
                    const external = account.label === "EXTERNAL_ADMIN" || account.label === "EXTERNAL_MEMBER";
                    return (
                      <div key={account.id} className="flex flex-col gap-2 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserCircle2 size={16} className="text-ink-faint shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-ink truncate">{account.name || account.email}</p>
                              <p className="text-xs text-ink-faint truncate">{account.email}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAccount(account.id)}
                            disabled={deletingId === account.id}
                            aria-label={t("Remove {name}", { name: account.email })}
                            className="text-ink-faint hover:text-danger-500 transition-colors shrink-0"
                          >
                            {deletingId === account.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          <input
                            className="input py-1 text-sm"
                            value={nicknames[account.id] ?? account.nickname ?? ""}
                            placeholder={t("Nickname")}
                            aria-label={t("Nickname for {email}", { email: account.email })}
                            onChange={(e) => setNicknames((current) => ({ ...current, [account.id]: e.target.value }))}
                            onBlur={() => saveNickname(account)}
                          />
                          <select
                            className="input py-1 text-sm"
                            aria-label={t("Payroll category for {email}", { email: account.email })}
                            value={account.category || ""}
                            onChange={(e) => {
                              const category = e.target.value;
                              if (!category) {
                                patchAccount(account, { category: null, label: null, companyName: "" });
                                return;
                              }
                              patchAccount(account, {
                                category,
                                label: account.label || "MEMBER",
                                companyName: account.companyName,
                              });
                            }}
                          >
                            <option value="">{t("Not set")}</option>
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {t(CATEGORY_TEXT[category])}
                              </option>
                            ))}
                          </select>
                          <select
                            className="input py-1 text-sm"
                            aria-label={t("Role for {email}", { email: account.email })}
                            value={account.label || ""}
                            onChange={(e) => {
                              const label = e.target.value;
                              if (!label && !account.category) {
                                patchAccount(account, { category: null, label: null, companyName: "" });
                                return;
                              }
                              patchAccount(account, {
                                category: account.category || "HR_PLUS_STAFF",
                                label: label || "MEMBER",
                                companyName: account.companyName,
                              });
                            }}
                          >
                            <option value="">{t("Not set")}</option>
                            {LABELS.map((label) => (
                              <option key={label} value={label}>
                                {t(LABEL_TEXT[label])}
                              </option>
                            ))}
                          </select>
                          {external ? (
                            companies.length > 0 ? (
                              <select
                                className="input py-1 text-sm"
                                aria-label={t("Company name")}
                                value={account.companyName}
                                onChange={(e) =>
                                  patchAccount(account, {
                                    category: account.category || "HR_PLUS_STAFF",
                                    label: account.label,
                                    companyName: e.target.value,
                                  })
                                }
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
                                className="input py-1 text-sm"
                                placeholder={t("Their company")}
                                aria-label={t("Company name")}
                                defaultValue={account.companyName}
                                onBlur={(e) => {
                                  if (e.target.value.trim() === (account.companyName || "")) return;
                                  patchAccount(account, {
                                    category: account.category || "HR_PLUS_STAFF",
                                    label: account.label,
                                    companyName: e.target.value,
                                  });
                                }}
                              />
                            )
                          ) : (
                            <span className="text-xs text-ink-faint self-center">{account.label ? t(LABEL_TEXT[account.label]) : ""}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
          <label className="label">{t("Nickname")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("e.g. AT")}
            value={draft.nickname}
            onChange={(e) => setDraft((current) => ({ ...current, nickname: e.target.value }))}
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
        {(draft.label === "EXTERNAL_ADMIN" || draft.label === "EXTERNAL_MEMBER") && (
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
      <button type="button" onClick={addAccount} disabled={saving || !draft.email.trim()} className="btn-secondary self-start">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {t("Add account")}
      </button>
    </div>
  );
}
