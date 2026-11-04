"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import DeleteButton from "@/components/DeleteButton";
import { useT } from "@/lib/i18n/client";

export type TemplateRow = {
  id: string;
  kind: "quotation" | "recruitment";
  name: string;
  detail: string;
};

export default function TemplateLibrary({ rows }: { rows: TemplateRow[] }) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "quotation" | "recruitment">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"quotation" | "recruitment">("quotation");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [requirements, setRequirements] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (tab !== "all" && row.kind !== tab) return false;
      if (!q) return true;
      return `${row.name} ${row.detail} ${row.kind}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  async function createRecruitment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/recruitment-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, requirements }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not save the template."));
      setOpen(false);
      setName("");
      setRole("");
      setRequirements("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    ["all", "All Templates"],
    ["quotation", "Quotation Templates"],
    ["recruitment", "Recruitment Templates"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search templates")}
        />
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`stamp ${tab === id ? "border-brand-500 text-brand-500" : "border-line text-ink-muted"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary sm:ml-auto shrink-0" onClick={() => { setKind("quotation"); setOpen(true); setError(""); }}>
          <Plus size={15} /> {t("New Template")}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Template name")}</th>
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Type")}</th>
              <th className="px-4 py-3 font-sans text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Details")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-ink-muted">{t("No templates match.")}</td>
              </tr>
            ) : shown.map((row) => (
              <tr key={`${row.kind}-${row.id}`} className="border-b border-line last:border-0 hover:bg-paper">
                <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                <td className="px-4 py-3">
                  <span className="stamp border-line text-ink-muted">{row.kind === "quotation" ? t("Quotation") : t("Recruitment")}</span>
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.detail || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={row.kind === "quotation" ? `/quotations/new?template=${row.id}` : `/recruitment/new?template=${row.id}`}
                      className="btn-primary"
                    >
                      {t("Use template")}
                    </Link>
                    {row.kind === "quotation" ? (
                      <Link href={`/quotations/templates/${row.id}/edit`} className="btn-secondary">{t("Edit")}</Link>
                    ) : null}
                    <DeleteButton
                      url={row.kind === "quotation" ? `/api/quotation-templates/${row.id}` : `/api/recruitment-templates/${row.id}`}
                      confirmNumber={row.name}
                      itemLabel="template"
                      redirectTo="/quotations/templates"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
          <form className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} onSubmit={kind === "recruitment" ? createRecruitment : (e) => e.preventDefault()}>
            <h2 className="font-display text-lg font-semibold">{t("New Template")}</h2>
            <label className="label mt-3">{t("Type")}</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "quotation" | "recruitment")}>
              <option value="quotation">{t("Quotation")}</option>
              <option value="recruitment">{t("Recruitment")}</option>
            </select>
            {kind === "quotation" ? (
              <p className="mt-3 text-sm text-ink-muted">{t("Quotation templates still use the existing form, with activity name and line items.")}</p>
            ) : (
              <>
                <label className="label mt-3">{t("Template name")}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                <label className="label mt-3">{t("Job role")}</label>
                <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
                <label className="label mt-3">{t("Requirements")}</label>
                <textarea className="input min-h-[88px]" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
              </>
            )}
            {error ? <p className="mt-2 text-xs text-danger-500">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              {kind === "quotation" ? (
                <Link href="/quotations/templates/new" className="btn-primary">{t("Continue")}</Link>
              ) : (
                <button className="btn-primary" disabled={saving} type="submit">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : t("Save")}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t("Cancel")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
