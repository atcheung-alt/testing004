"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import clsx from "clsx";

type Person = { id: string; email: string; name: string; isAdmin: boolean };
type Group = { id: string; name: string; pages: string[]; emails: string[] };
type PageOption = { id: string; href: string; label: string };

function newGroupId() {
  return `group_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export default function ManagementWorkspace() {
  const t = useT();
  const [people, setPeople] = useState<Person[]>([]);
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

  useEffect(() => {
    fetch("/api/access")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data.people)) throw new Error(data.error || "Could not load access groups.");
        setPeople(data.people);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        setPages(Array.isArray(data.pages) ? data.pages : []);
        setFullAccessEmails(Array.isArray(data.fullAccessEmails) ? data.fullAccessEmails : []);
        if (typeof data.adminGroupId === "string") setAdminGroupId(data.adminGroupId);
        if (typeof data.fullGroupId === "string") setFullGroupId(data.fullGroupId);
        setReady(data.ready !== false);
        setSelectedId(data.groups?.[0]?.id ?? null);
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

      <section className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} className="text-brand-500" />
          <h2 className="font-display text-lg font-semibold">{t("Always full access")}</h2>
        </div>
        <p className="text-sm text-ink-muted mb-3">
          {t("These accounts are in the Admin group. They can open every page.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {lockedPeople.map((person) => (
            <span key={person.id} className="rounded-full bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1">
              {person.name || person.email}
              <span className="text-ink-faint"> · {person.email}</span>
              {person.isAdmin && <span> · {t("Already an admin")}</span>}
            </span>
          ))}
          {fullAccessEmails
            .filter((email) => !lockedPeople.some((person) => person.email.toLowerCase() === email.toLowerCase()))
            .map((email) => (
              <span key={email} className="rounded-full bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1">
                {email}
              </span>
            ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[18rem_1fr] gap-4">
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{t("Groups")}</h2>
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
            <div className="flex flex-col gap-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedId(group.id)}
                  className={clsx(
                    "text-left rounded-xl px-3 py-2 transition-colors",
                    group.id === selectedId ? "bg-brand-gradient text-white" : "hover:bg-brand-50"
                  )}
                >
                  <p className="text-sm font-medium truncate">{group.name}</p>
                  <p className={clsx("text-xs", group.id === selectedId ? "text-white/80" : "text-ink-faint")}>
                    {t("{count} people", { count: group.emails.length })} · {t("{count} pages", { count: group.pages.length })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card p-5 flex flex-col gap-4">
          {selected ? (
            <>
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
                            pages: on
                              ? selected.pages.filter((id) => id !== page.id)
                              : [...selected.pages, page.id],
                          });
                        }}
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
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
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t("No groups yet. Everyone still has full access.")}</p>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold">{t("People")}</h2>
          <input
            className="input sm:max-w-xs"
            placeholder={t("Search name or email")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {shownPeople.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No matching people.")}</p>
        ) : (
          <div className="divide-y divide-line">
            {shownPeople.map((person) => (
              <div key={person.id} className="flex items-center justify-between gap-3 py-2">
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
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
