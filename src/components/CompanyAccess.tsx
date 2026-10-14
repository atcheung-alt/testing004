"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { useT } from "@/lib/i18n/client";

type CompanyRow = { id: string; name: string; label: string; sections?: string };
type UserRow = { id: string; name: string; email: string; status: string; role: string; sections: string };

function sectionList(raw: string): SectionId[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CompanyAccess() {
  const t = useT();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/company")
      .then((res) => res.json())
      .then((data) => {
        setCompany(data.company || null);
        setName(data.company?.name || "");
        setLabel(data.company?.label || "");
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
      body: JSON.stringify({ name, label }),
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
        <form onSubmit={saveCompany} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
          <div>
            <label className="label">{t("Company name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("Label")}</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("Save")}
          </button>
        </form>
      </section>

      <section className="card divide-y divide-line">
        {users.map((user) => {
          const selected = new Set(sectionList(user.sections));
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
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {SECTIONS.filter((section) => sectionList(company?.sections || "[]").includes(section.id)).map((section) => (
                  <label key={section.id} className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(section.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        saveUser(user.id, { sections: Array.from(next) });
                      }}
                    />
                    {t(section.label)}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
