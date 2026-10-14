"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type GroupRow = { id: string; number: number; name?: string; sections: string };
type CompanyRow = { id: string; name: string; label: string; sections?: string; groups?: GroupRow[] };
type UserRow = { id: string; name: string; email: string; status: string; role: string; sections: string; groupId?: string | null };

export default function CompanyAccess() {
  const t = useT();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/company")
      .then((res) => res.json())
      .then((data) => {
        setCompany(data.company || null);
        setName(data.company?.name || "");
        setUsers(Array.isArray(data.users) ? data.users : []);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("Could not save."));
      return;
    }
    load();
  }

  async function saveUser(userId: string, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t("Could not save."));
      return;
    }
    load();
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-sm text-danger-500">{error}</p>}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-1">{company?.label || t("Company")}</h2>
        <p className="text-sm text-ink-muted mb-4">{t("You can change this company only.")}</p>
        <p className="text-xs text-ink-faint mb-3">{t("Label")} {company?.label}</p>
        <form onSubmit={saveCompany} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="label">{t("Company name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("Save")}
          </button>
        </form>
      </section>

      <section className="card divide-y divide-line">
        {users.map((user) => {
          const groups = company?.groups || [];
          return (
            <div key={user.id} className="px-4 py-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{user.name || user.email}</p>
                  <p className="text-xs text-ink-muted">{user.email}</p>
                  <p className="text-xs text-ink-faint mt-0.5">{user.role} · {user.status}</p>
                </div>
                <div className="flex gap-2">
                  {user.status !== "ACTIVE" && (
                    <button type="button" className="btn-primary" onClick={() => saveUser(user.id, { status: "ACTIVE" })}>
                      {t("Confirm")}
                    </button>
                  )}
                  {user.status !== "CANCELLED" && (
                    <button type="button" className="btn-secondary" onClick={() => saveUser(user.id, { status: "CANCELLED" })}>
                      {t("Cancel account")}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={user.role === "COMPANY_ADMIN"} onChange={() => saveUser(user.id, { role: "COMPANY_ADMIN" })} />
                  {t("Company admin")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={user.role === "MEMBER" || user.role === "SUPER"} onChange={() => saveUser(user.id, { role: "MEMBER" })} />
                  {t("Member")}
                </label>
              </div>
              <label className="text-sm">
                <span className="label">{t("Group")}</span>
                <select
                  className="input"
                  value={user.groupId || ""}
                  onChange={(e) => saveUser(user.id, { groupId: e.target.value || null })}
                >
                  <option value="">{t("No group")}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name?.trim() || `${t("Group")} ${group.number}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          );
        })}
      </section>
    </div>
  );
}
