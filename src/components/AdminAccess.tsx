"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { useT } from "@/lib/i18n/client";

type CompanyRow = { id: string; name: string; label: string; sections: string; _count?: { users: number } };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  sections: string;
  companyId: string | null;
  company: { id: string; name: string; label: string } | null;
};

function sectionList(raw: string): SectionId[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminAccess() {
  const t = useT();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([fetch("/api/admin/companies").then((r) => r.json()), fetch("/api/admin/users").then((r) => r.json())]).then(
      ([companyRows, userRows]) => {
        setCompanies(Array.isArray(companyRows) ? companyRows : []);
        setUsers(Array.isArray(userRows) ? userRows : []);
      }
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, label }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("Could not save."));
      return;
    }
    setName("");
    setLabel("");
    load();
  }

  async function saveUser(user: UserRow, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
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

      <section className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Companies")}</h2>
          <p className="text-sm text-ink-muted mt-1">
            {t("Each company has its own label. Its documents stay separate, and the ticks below are the only parts that company can open.")}
          </p>
        </div>
        <form onSubmit={addCompany} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
          <div>
            <label className="label">{t("Company name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("Label")}</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ACME" />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("Add company")}
          </button>
        </form>
        <div className="divide-y divide-line border border-line rounded-lg">
          {companies.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("No companies yet.")}</p>
          ) : (
            companies.map((company) => (
              <CompanyEditor
                key={company.id}
                company={company}
                onSaved={load}
                onError={(message) => setError(message)}
              />
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("Accounts")}</h2>
        <div className="card divide-y divide-line">
          {users.map((user) => {
            const selected = new Set(sectionList(user.sections));
            return (
              <div key={user.id} className="px-4 py-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{user.name || user.email}</p>
                    <p className="text-xs text-ink-muted">{user.email}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {user.company ? `${user.company.label} · ${user.company.name}` : t("No company")} · {user.role} · {user.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.status !== "ACTIVE" && (
                      <button type="button" className="btn-primary" onClick={() => saveUser(user, { status: "ACTIVE", role: user.role === "SUPER" ? "SUPER" : user.role })}>
                        {t("Confirm")}
                      </button>
                    )}
                    {user.status !== "CANCELLED" && user.role !== "SUPER" && (
                      <button type="button" className="btn-secondary" onClick={() => saveUser(user, { status: "CANCELLED" })}>
                        {t("Cancel account")}
                      </button>
                    )}
                  </div>
                </div>
                {user.role !== "SUPER" && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm">
                      <span className="label">{t("Label")}</span>
                      <select
                        className="input"
                        value={user.companyId || ""}
                        onChange={(e) => saveUser(user, { companyId: e.target.value })}
                      >
                        <option value="">{t("Choose a company")}</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.label} · {company.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`role-${user.id}`}
                          checked={user.role === "COMPANY_ADMIN"}
                          onChange={() => saveUser(user, { role: "COMPANY_ADMIN" })}
                        />
                        {t("Company admin")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`role-${user.id}`}
                          checked={user.role === "MEMBER"}
                          onChange={() => saveUser(user, { role: "MEMBER" })}
                        />
                        {t("Member")}
                      </label>
                    </div>
                    {user.companyId && sectionList(companies.find((item) => item.id === user.companyId)?.sections || "[]").length === 0 && (
                      <p className="text-xs text-ink-muted">{t("Tick what this company can open on its label above.")}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {SECTIONS.filter((section) => {
                        const company = companies.find((item) => item.id === user.companyId);
                        return company ? sectionList(company.sections).includes(section.id) : false;
                      }).map((section) => (
                        <label key={section.id} className="flex items-center gap-2 text-sm text-ink-muted">
                          <input
                            type="checkbox"
                            checked={selected.has(section.id)}
                            onChange={() => {
                              const next = new Set(selected);
                              if (next.has(section.id)) next.delete(section.id);
                              else next.add(section.id);
                              saveUser(user, { sections: Array.from(next) });
                            }}
                          />
                          {t(section.label)}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CompanyEditor({
  company,
  onSaved,
  onError,
}: {
  company: CompanyRow;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(company.name);
  const [label, setLabel] = useState(company.label);
  const [selected, setSelected] = useState<SectionId[]>(sectionList(company.sections || "[]"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(company.name);
    setLabel(company.label);
    setSelected(sectionList(company.sections || "[]"));
  }, [company.id, company.name, company.label, company.sections]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, label, sections: selected }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="px-4 py-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
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
      </div>
      <p className="text-xs text-ink-muted">
        {t("Accounts")}: {company._count?.users || 0}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {SECTIONS.map((section) => (
          <label key={section.id} className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={selected.includes(section.id)}
              onChange={() => {
                setSelected((current) =>
                  current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id]
                );
              }}
            />
            {t(section.label)}
          </label>
        ))}
      </div>
    </form>
  );
}
