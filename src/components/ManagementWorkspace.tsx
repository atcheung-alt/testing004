"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ChevronDown, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import AccessRequestQueue from "@/components/AccessRequestQueue";
import ExpenseCategoriesManager from "@/components/ExpenseCategoriesManager";
import SettingsForm from "@/components/SettingsForm";
import StaffAccountsManager from "@/components/StaffAccountsManager";
import clsx from "clsx";

type Person = {
  id: string;
  email: string;
  name: string;
  nickname: string;
  isAdmin: boolean;
  category: string | null;
  label: string | null;
  companyName: string;
};
type AccessRequestRow = {
  id: string;
  email: string;
  name: string;
  companyName: string;
  note: string;
  createdAt: string;
};
type CompanyOption = { id: string; name: string };
type Group = { id: string; name: string; pages: string[]; emails: string[] };
type PageOption = { id: string; href: string; label: string };

const CATEGORIES = [
  ["HR_PLUS_STAFF", "HR Plus staff"],
  ["FULL_TIME", "Full-time"],
  ["PART_TIME", "Part-time"],
  ["FREELANCE", "Freelance"],
] as const;
const ROLES = [
  ["ADMIN", "Admin"],
  ["MEMBER", "Member"],
  ["EXTERNAL_ADMIN", "External admin"],
  ["EXTERNAL_MEMBER", "External member"],
] as const;

function newGroupId() {
  return `group_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function Fold({
  title,
  summary,
  open,
  onToggle,
  delay,
  icon,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  delay: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 animate-settle" style={{ animationDelay: delay }}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown
            size={16}
            className={clsx("text-ink-faint shrink-0 transition-transform duration-300", open && "rotate-180")}
          />
          {icon}
          <h2 className="font-display text-lg font-semibold">{title}</h2>
        </span>
        {!open && <span className="text-sm text-ink-muted shrink-0">{summary}</span>}
      </button>
      <div className="mgmt-fold" data-open={open ? "true" : "false"}>
        <div className="mgmt-fold-inner">
          <div className={clsx("pt-4", open && "animate-fade-in")}>{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function ManagementWorkspace() {
  const t = useT();
  const [people, setPeople] = useState<Person[]>([]);
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [fullAccessEmails, setFullAccessEmails] = useState<string[]>([]);
  const [adminGroupId, setAdminGroupId] = useState("group_admin");
  const [fullGroupId, setFullGroupId] = useState("group_full");
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [query, setQuery] = useState("");
  const [openSection, setOpenSection] = useState<"requests" | "admins" | "groups" | "people" | null>(null);

  useEffect(() => {
    fetch("/api/access")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.people)) throw new Error(data.error || "Could not load access groups.");
        setPeople(data.people);
        setRequests(Array.isArray(data.requests) ? data.requests : []);
        setCompanies(Array.isArray(data.companies) ? data.companies : []);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        setPages(Array.isArray(data.pages) ? data.pages : []);
        setFullAccessEmails(Array.isArray(data.fullAccessEmails) ? data.fullAccessEmails : []);
        if (typeof data.adminGroupId === "string") setAdminGroupId(data.adminGroupId);
        if (typeof data.fullGroupId === "string") setFullGroupId(data.fullGroupId);
        setReady(data.ready !== false);
        setSelectedId(data.groups?.[0]?.id ?? null);
        if (Array.isArray(data.requests) && data.requests.length > 0) setOpenSection("requests");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const lockedEmails = useMemo(() => {
    const emails = new Set(fullAccessEmails.map((email) => email.toLowerCase()));
    for (const person of people) {
      if (person.isAdmin) emails.add(person.email.toLowerCase());
    }
    return emails;
  }, [fullAccessEmails, people]);

  const lockedPeople = people.filter((person) => lockedEmails.has(person.email.toLowerCase()));
  const extraLockedEmails = fullAccessEmails.filter(
    (email) => !lockedPeople.some((person) => person.email.toLowerCase() === email.toLowerCase())
  );
  const selected = groups.find((group) => group.id === selectedId) || null;
  const shownPeople = people.filter((person) => {
    const haystack = `${person.name} ${person.email}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  async function persist(next: Group[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save access groups.");
      setGroups(Array.isArray(data.groups) ? data.groups : next);
      setReady(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function createGroup() {
    const name = draftName.trim();
    if (!name) {
      setError("Enter a group name.");
      return;
    }
    const group = { id: newGroupId(), name, pages: pages.map((page) => page.id), emails: [] };
    setDraftName("");
    setSelectedId(group.id);
    setOpenSection("groups");
    persist([...groups, group]);
  }

  function updateSelected(patch: Partial<Group>) {
    if (!selected) return;
    persist(groups.map((group) => (group.id === selected.id ? { ...group, ...patch } : group)));
  }

  function movePerson(email: string, groupId: string) {
    if (!groupId || lockedEmails.has(email.toLowerCase())) return;
    const normalized = email.toLowerCase();
    const next = groups.map((group) => ({
      ...group,
      emails: group.emails.filter((item) => item !== normalized),
    }));
    const target = next.find((group) => group.id === groupId);
    if (target) target.emails.push(normalized);
    persist(next);
  }

  function groupIdFor(email: string) {
    return groups.find((group) => group.emails.includes(email.toLowerCase()))?.id || "";
  }

  async function reloadAccess() {
    const res = await fetch("/api/access");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load access groups.");
    setPeople(data.people);
    setRequests(Array.isArray(data.requests) ? data.requests : []);
    setCompanies(Array.isArray(data.companies) ? data.companies : []);
  }

  async function savePersonAccess(person: Person) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/access/person", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: person.id,
          category: person.category,
          label: person.label,
          companyName: person.companyName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save this person's access.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-ink-muted">{t("Loading…")}</p>;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}
      {!ready && !error && (
        <div className="flex items-start gap-2 bg-paper border border-line text-ink-muted text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            {t(
              "Access groups are not on the database yet. Everyone keeps full access, and no existing records were changed."
            )}
          </span>
        </div>
      )}

      <StaffAccountsManager />

      <Fold
        title={t("Access requests")}
        summary={t("{count} waiting", { count: requests.length })}
        open={openSection === "requests"}
        delay="0.02s"
        onToggle={() => setOpenSection((current) => (current === "requests" ? null : "requests"))}
      >
        <AccessRequestQueue
          requests={requests}
          companies={companies}
          saving={saving}
          onError={setError}
          onDone={reloadAccess}
        />
      </Fold>

      <Fold
        title={t("Always Full Access")}
        summary={t("{count} Accounts", { count: lockedPeople.length + extraLockedEmails.length })}
        open={openSection === "admins"}
        delay="0.02s"
        icon={<Lock size={16} className="text-brand-500 shrink-0" />}
        onToggle={() => setOpenSection((current) => (current === "admins" ? null : "admins"))}
      >
        <p className="text-sm text-ink-muted mb-3">
          {t("These accounts are in the Admin group. They can open every page.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {lockedPeople.map((person) => (
            <span key={person.id} className="rounded-full bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1">
              {person.name || person.email}
              <span className="text-ink-faint"> · {person.email}</span>
              {(person.isAdmin ||
                fullAccessEmails.some((email) => email.toLowerCase() === person.email.toLowerCase())) && (
                <span> · {t("Already an admin")}</span>
              )}
            </span>
          ))}
          {extraLockedEmails.map((email) => (
            <span key={email} className="rounded-full bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1">
              {email}
              <span> · {t("Already an admin")}</span>
            </span>
          ))}
        </div>
      </Fold>

      <Fold
        title={t("Groups")}
        summary={t("{count} Groups", { count: groups.length })}
        open={openSection === "groups"}
        delay="0.08s"
        onToggle={() => setOpenSection((current) => (current === "groups" ? null : "groups"))}
      >
        <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={t("e.g. Finance")}
                aria-label={t("New group name")}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createGroup();
                }}
              />
              <button type="button" className="btn-primary shrink-0" onClick={createGroup} disabled={saving}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {t("Create group")}
              </button>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("No groups yet. Everyone still has full access.")}</p>
            ) : (
              <select
                className="input"
                aria-label={t("Choose a group")}
                value={selected?.id || ""}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} · {t("{count} People", { count: group.emails.length })} · {t("{count} Pages", { count: group.pages.length })}
                  </option>
                ))}
              </select>
            )}
            {selected && (
              <div key={selected.id} className="animate-fade-in flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-1">
                    <label className="label">{t("Group name")}</label>
                    <input
                      className="input"
                      value={selected.name}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((group) =>
                            group.id === selected.id ? { ...group, name: event.target.value } : group
                          )
                        )
                      }
                      onBlur={(event) => {
                        const name = event.target.value.trim();
                        if (name) updateSelected({ name });
                      }}
                    />
                  </div>
                  {selected.id !== adminGroupId && selected.id !== fullGroupId ? (
                    <button
                      type="button"
                      className="btn-secondary text-danger-500"
                      onClick={() => {
                        const moving = selected.emails;
                        const next = groups
                          .filter((group) => group.id !== selected.id)
                          .map((group) =>
                            group.id === fullGroupId ? { ...group, emails: [...group.emails, ...moving] } : group
                          );
                        setSelectedId(fullGroupId);
                        persist(next);
                      }}
                    >
                      <Trash2 size={15} />
                      {t("Delete group")}
                    </button>
                  ) : (
                    <p className="text-xs text-ink-muted sm:mb-2">
                      {selected.id === adminGroupId
                        ? t("The Admin group always includes every page.")
                        : t("This default group stays so every account has a group.")}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-medium">{t("Pages this group can open")}</p>
                    {selected.id !== adminGroupId && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-500"
                          onClick={() => updateSelected({ pages: pages.map((page) => page.id) })}
                        >
                          {t("All pages")}
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-ink-muted"
                          onClick={() => updateSelected({ pages: [] })}
                        >
                          {t("Clear")}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pages.map((page) => {
                      const on = selected.pages.includes(page.id);
                      return (
                        <button
                          key={page.id}
                          type="button"
                          disabled={selected.id === adminGroupId}
                          onClick={() => {
                            if (selected.id === adminGroupId) return;
                            updateSelected({
                              pages: on ? selected.pages.filter((id) => id !== page.id) : [...selected.pages, page.id],
                            });
                          }}
                          className={clsx(
                            "rounded-full px-3 py-1 text-xs font-medium border transition-colors duration-200",
                            on
                              ? "bg-brand-500 border-brand-500 text-white"
                              : "bg-surface border-line text-ink-muted hover:border-brand-500"
                          )}
                        >
                          {t(page.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
      </Fold>

      <Fold
        title={t("People")}
        summary={t("{count} People", { count: people.length })}
        open={openSection === "people"}
        delay="0.14s"
        onToggle={() => setOpenSection((current) => (current === "people" ? null : "people"))}
      >
        <div>
            <input
              className="input sm:max-w-xs mb-3"
              placeholder={t("Search name or email")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {shownPeople.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("No matching people.")}</p>
            ) : (
              <div className="divide-y divide-line">
                {shownPeople.map((person) => {
                  const external = person.label === "EXTERNAL_ADMIN" || person.label === "EXTERNAL_MEMBER";
                  return (
                  <div key={person.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink truncate">{person.name || person.email}</p>
                      <p className="text-xs text-ink-faint truncate">{person.email}</p>
                    </div>
                    <select
                      className="input w-44 shrink-0"
                      value={lockedEmails.has(person.email.toLowerCase()) ? adminGroupId : groupIdFor(person.email) || fullGroupId}
                      onChange={(event) => movePerson(person.email, event.target.value)}
                      disabled={saving || lockedEmails.has(person.email.toLowerCase())}
                      aria-label={person.email}
                    >
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-ink-muted">
                        {t("Payroll category")}
                        <select
                          className="input py-1 text-sm"
                          value={person.category || ""}
                          onChange={(event) =>
                            setPeople((current) =>
                              current.map((item) =>
                                item.id === person.id ? { ...item, category: event.target.value || null } : item
                              )
                            )
                          }
                        >
                          <option value="">{t("Not set")}</option>
                          {CATEGORIES.map(([value, label]) => (
                            <option key={value} value={value}>
                              {t(label)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-ink-muted">
                        {t("Role")}
                        <select
                          className="input py-1 text-sm"
                          value={person.label || ""}
                          onChange={(event) =>
                            setPeople((current) =>
                              current.map((item) =>
                                item.id === person.id ? { ...item, label: event.target.value || null } : item
                              )
                            )
                          }
                        >
                          <option value="">{t("Not set")}</option>
                          {ROLES.map(([value, label]) => (
                            <option key={value} value={value}>
                              {t(label)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {external ? (
                        <select
                          className="input py-1 text-sm"
                          value={person.companyName}
                          onChange={(event) =>
                            setPeople((current) =>
                              current.map((item) =>
                                item.id === person.id ? { ...item, companyName: event.target.value } : item
                              )
                            )
                          }
                        >
                          <option value="">{t("Their company")}</option>
                          {companies.map((company) => (
                            <option key={company.id} value={company.name}>
                              {company.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button type="button" className="btn-secondary" disabled={saving} onClick={() => savePersonAccess(person)}>
                          {t("Save access")}
                        </button>
                      )}
                    </div>
                    {external && (
                      <button type="button" className="btn-secondary self-start" disabled={saving} onClick={() => savePersonAccess(person)}>
                        {t("Save access")}
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
        </div>
      </Fold>

      <ExpenseCategoriesManager />
      <SettingsForm part="company" />
    </div>
  );
}
