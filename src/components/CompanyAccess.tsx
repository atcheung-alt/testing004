"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import CompanyLogoUpload from "@/components/CompanyLogoUpload";
import { useT } from "@/lib/i18n/client";

type GroupRow = { id: string; number: number; name?: string; sections: string };
type CompanyRow = {
  id: string;
  name: string;
  label: string;
  website?: string;
  logo?: string | null;
  logoDark?: string | null;
  sections?: string;
  groups?: GroupRow[];
};
type UserRow = { id: string; name: string; email: string; status: string; role: string; sections: string; groupId?: string | null };

export default function CompanyAccess() {
  const t = useT();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoDark, setLogoDark] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/company")
      .then((res) => res.json())
      .then((data) => {
        setCompany(data.company || null);
        setName(data.company?.name || "");
        setWebsite(data.company?.website || "");
        setLogo(data.company?.logo || null);
        setLogoDark(data.company?.logoDark || null);
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
      body: JSON.stringify({ name, website, logo, logoDark }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || t("Could not save."));
      return;
    }
    load();
    router.refresh();
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
        <p className="text-sm text-ink-muted mb-4">{t("Shown on your company's pages, PDFs, and emails.")}</p>
        <p className="text-xs text-ink-faint mb-3">{t("Label")} {company?.label}</p>
        <form onSubmit={saveCompany} className="flex flex-col gap-4">
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="label">{t("Company logo (primary)")}</p>
              <CompanyLogoUpload imageData={logo} onChange={setLogo} label={t("primary company logo")} />
            </div>
            <div>
              <p className="label">{t("Company logo (dark mode)")}</p>
              <CompanyLogoUpload imageData={logoDark} onChange={setLogoDark} label={t("dark mode company logo")} />
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-[220px]">
              <div>
                <label className="label">{t("Company name")}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("Company website")}</label>
                <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
            </div>
          </div>
          <button type="submit" className="btn-primary self-start" disabled={saving || !name.trim()}>
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
