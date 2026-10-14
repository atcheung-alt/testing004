"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { useT } from "@/lib/i18n/client";

type GroupRow = { id: string; number: number; sections: string };
type CompanyRow = { id: string; name: string; label: string; sections: string; groups?: GroupRow[]; _count?: { users: number } };
type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  sections: string;
  companyId: string | null;
  groupId: string | null;
  company: { id: string; name: string; label: string } | null;
  group: { id: string; number: number } | null;
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
            {t("Each company keeps its own documents. Groups 1, 2 and 3 share that company, and each group opens different parts.")}
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
          <button type="submit" className="btn-primary" disabled={saving || !name.trim() || !label.trim()}>
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
            const groups = companies.find((item) => item.id === user.companyId)?.groups || [];
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
                    <label className="text-sm">
                      <span className="label">{t("Group")}</span>
                      <select
                        className="input"
                        value={user.groupId || ""}
                        onChange={(e) => saveUser(user, { groupId: e.target.value || null })}
                      >
                        <option value="">{t("No group")}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {t("Group")} {group.number}
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
                    <p className="text-xs text-ink-muted">{t("Access follows the group. Change the ticks on that group above.")}</p>
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
  const [saving, setSaving] = useState(false);
  const groups = company.groups || [];

  useEffect(() => {
    setName(company.name);
    setLabel(company.label);
  }, [company.id, company.name, company.label]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, label }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  async function addGroups(preset: boolean) {
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${company.id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset ? { preset: true } : {}),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
        <div>
          <label className="label">{t("Company name")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("Label")}</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving || !name.trim() || !label.trim()}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : null}
          {t("Save")}
        </button>
      </form>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <GroupEditor key={group.id} companyId={company.id} group={group} onSaved={onSaved} onError={onError} />
        ))}
        <button type="button" className="btn-secondary self-start" disabled={saving} onClick={() => addGroups(groups.length === 0)}>
          {groups.length === 0 ? t("Add groups 1, 2 and 3") : t("Add group")}
        </button>
      </div>
    </div>
  );
}

function GroupEditor({
  companyId,
  group,
  onSaved,
  onError,
}: {
  companyId: string;
  group: GroupRow;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<SectionId[]>(sectionList(group.sections || "[]"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(sectionList(group.sections || "[]"));
  }, [group.id, group.sections]);

  async function save(next: SectionId[]) {
    setSelected(next);
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${companyId}/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  return (
    <div className="rounded-lg border border-line px-3 py-3 flex flex-col gap-2">
      <p className="text-sm font-medium">
        {t("Group")} {group.number}
        {saving ? <Loader2 size={14} className="inline ml-2 animate-spin" /> : null}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {SECTIONS.map((section) => (
          <label key={section.id} className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={selected.includes(section.id)}
              onChange={() => {
                const next = selected.includes(section.id)
                  ? selected.filter((id) => id !== section.id)
                  : [...selected, section.id];
                save(next);
              }}
            />
            {t(section.label)}
          </label>
        ))}
      </div>
    </div>
  );
}
