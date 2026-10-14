"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { useT } from "@/lib/i18n/client";

type GroupRow = { id: string; number: number; name?: string; sections: string };
type CompanyRow = { id: string; name: string; label: string; isHome?: boolean; sections: string; groups?: GroupRow[]; _count?: { users: number } };
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
  const [query, setQuery] = useState("");
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
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
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("Could not save."));
      return;
    }
    setName("");
    if (data?.id) setOpenCompanyId(data.id);
    load();
  }

  const needle = query.trim().toLowerCase();
  const visibleCompanies = companies.filter((company) => {
    if (!needle) return true;
    const groups = (company.groups || []).map((group) => group.name || `${t("Group")} ${group.number}`).join(" ");
    return `${company.name} ${company.label} ${groups}`.toLowerCase().includes(needle);
  });
  const visibleUsers = users.filter((user) => {
    if (!needle) return true;
    const group = companies.find((company) => company.id === user.companyId)?.groups?.find((item) => item.id === user.groupId);
    const groupName = group?.name || (group ? `${t("Group")} ${group.number}` : "");
    return `${user.name} ${user.email} ${user.company?.name || ""} ${user.company?.label || ""} ${groupName}`.toLowerCase().includes(needle);
  });

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
            {t("HR Plus is the default company and sees the same records as the admin. Other companies stay separate. The label is created for you. Add groups one at a time.")}
          </p>
        </div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search companies or people")}
        />
        <form onSubmit={addCompany} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="label">{t("Company name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {t("Add company")}
          </button>
        </form>
        <div className="divide-y divide-line border border-line rounded-lg">
          {companies.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("No companies yet.")}</p>
          ) : visibleCompanies.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("No matches.")}</p>
          ) : (
            visibleCompanies.map((company) => {
              const open = openCompanyId === company.id;
              return (
                <div key={company.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-paper"
                    onClick={() => setOpenCompanyId(open ? null : company.id)}
                  >
                    <span>
                      <span className="block text-sm font-medium">{company.name}</span>
                      <span className="block text-xs text-ink-faint">
                        {company.label} · {(company.groups || []).length} {t("groups")} · {company._count?.users || 0} {t("Accounts")}
                      </span>
                    </span>
                    <ChevronDown size={16} className={open ? "rotate-180 shrink-0" : "shrink-0"} />
                  </button>
                  {open && (
                    <CompanyEditor company={company} onSaved={load} onError={(message) => setError(message)} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold">{t("Accounts")}</h2>
        <div className="card divide-y divide-line">
          {users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("No accounts yet.")}</p>
          ) : visibleUsers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("No matches.")}</p>
          ) : visibleUsers.map((user) => {
            const open = openUserId === user.id;
            const groups = companies.find((item) => item.id === user.companyId)?.groups || [];
            return (
              <div key={user.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-paper"
                  onClick={() => setOpenUserId(open ? null : user.id)}
                >
                  <span>
                    <span className="block text-sm font-medium">{user.name || user.email}</span>
                    <span className="block text-xs text-ink-faint">
                      {user.email} · {user.company ? user.company.name : t("No company")} · {user.status}
                    </span>
                  </span>
                  <ChevronDown size={16} className={open ? "rotate-180 shrink-0" : "shrink-0"} />
                </button>
                {open && <div className="px-4 pb-4 flex flex-col gap-3">
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
                            {group.name?.trim() || `${t("Group")} ${group.number}`}
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
                </div>}
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
  const [saving, setSaving] = useState(false);
  const groups = company.groups || [];

  useEffect(() => {
    setName(company.name);
  }, [company.id, company.name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  async function addGroup() {
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${company.id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className="label">{t("Company name")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <p className="text-xs text-ink-faint mt-1">
            {t("Label")} {company.label}
            {company.isHome ? ` · ${t("Default company. Sees the same records as the admin.")}` : ""}
          </p>
        </div>
        <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : null}
          {t("Save")}
        </button>
      </form>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <GroupEditor key={group.id} companyId={company.id} group={group} onSaved={onSaved} onError={onError} />
        ))}
        <button type="button" className="btn-secondary self-start" disabled={saving} onClick={addGroup}>
          {t("Add group")}
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
  const [name, setName] = useState(group.name || "");
  const [selected, setSelected] = useState<SectionId[]>(sectionList(group.sections || "[]"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(group.name || "");
    setSelected(sectionList(group.sections || "[]"));
  }, [group.id, group.name, group.sections]);

  async function save(patch: { name?: string; sections?: SectionId[] }) {
    if (patch.sections) setSelected(patch.sections);
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${companyId}/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      onError(data.error || t("Could not save."));
      return;
    }
    onSaved();
  }

  async function remove() {
    if (!window.confirm(t("Delete this group? People in it will lose access until you choose another group."))) return;
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${companyId}/groups/${group.id}`, { method: "DELETE" });
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
      <div className="flex items-center gap-2">
        <input
          className="input"
          value={name}
          placeholder={`${t("Group")} ${group.number}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() !== (group.name || "").trim()) save({ name });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" disabled={saving} onClick={remove}>
          {t("Delete")}
        </button>
        {saving ? <Loader2 size={14} className="animate-spin shrink-0" /> : null}
      </div>
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
                save({ sections: next });
              }}
            />
            {t(section.label)}
          </label>
        ))}
      </div>
    </div>
  );
}
