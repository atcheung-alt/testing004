"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Check } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export type EmployerCompanyOption = {
  id: string;
  name: string;
  employeeCount: number;
};

export default function EmployerCompaniesManager({ companies }: { companies: EmployerCompanyOption[] }) {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addCompany() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy("new");
    setError(null);
    try {
      const res = await fetch("/api/employer-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add the company.");
      setName("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function rename(company: EmployerCompanyOption) {
    const next = (drafts[company.id] ?? company.name).trim();
    if (!next || next === company.name) return;
    setBusy(company.id);
    setError(null);
    try {
      const res = await fetch(`/api/employer-companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not rename the company.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(company: EmployerCompanyOption) {
    const message = company.employeeCount
      ? t("Remove {name}? Its {count} employees stay on file, under No company.", {
          name: company.name,
          count: company.employeeCount,
        })
      : t("Remove {name}?", { name: company.name });
    if (!window.confirm(message)) return;
    setBusy(company.id);
    setError(null);
    try {
      const res = await fetch(`/api/employer-companies/${company.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove the company.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      {error && <p className="text-sm text-danger-600">{t(error)}</p>}
      <div className="flex flex-col gap-2">
        {companies.map((company) => (
          <div key={company.id} className="flex items-center gap-2 border-b border-line pb-3 last:border-0">
            <input
              className="input"
              value={drafts[company.id] ?? company.name}
              onChange={(e) => setDrafts((current) => ({ ...current, [company.id]: e.target.value }))}
              onBlur={() => rename(company)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label={t("Company name")}
            />
            <span className="text-xs text-ink-faint shrink-0 w-16 text-right">
              {t("{count} people", { count: company.employeeCount })}
            </span>
            <button
              type="button"
              className="text-ink-faint hover:text-ink shrink-0"
              aria-label={t("Save company name")}
              onClick={() => rename(company)}
              disabled={busy === company.id}
            >
              {busy === company.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </button>
            <button
              type="button"
              className="text-ink-faint hover:text-danger-500 shrink-0"
              aria-label={t("Remove {name}", { name: company.name })}
              onClick={() => remove(company)}
              disabled={busy === company.id}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder={t("New company name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCompany();
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={addCompany} disabled={busy === "new"}>
          {busy === "new" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {t("Add company")}
        </button>
      </div>
    </div>
  );
}
