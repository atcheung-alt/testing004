"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import DeleteButton from "@/components/DeleteButton";
import { useT } from "@/lib/i18n/client";

export type TemplateRow = {
  id: string;
  code: string;
  kind: "quotation" | "recruitment";
  name: string;
  detail: string;
};

export default function TemplateLibrary({ rows, title, note }: { rows: TemplateRow[]; title: string; note: string }) {
  const t = useT();
  const [tab, setTab] = useState<"all" | "quotation" | "recruitment">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"quotation" | "recruitment">("quotation");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (tab !== "all" && row.kind !== tab) return false;
      if (!q) return true;
      return `${row.code} ${row.name} ${row.detail} ${row.kind}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  const tabs = [
    ["all", "All Templates"],
    ["quotation", "Quotation Templates"],
    ["recruitment", "Recruitment Templates"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-filters flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{title}</h1>
          <p className="lead">{note}</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={() => { setKind("quotation"); setOpen(true); }}>
          <Plus size={14} /> {t("New Template")}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="relative min-w-[12rem] flex-1 max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className="input pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search templates...")}
            aria-label={t("Search templates")}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`stamp bg-surface ${tab === id ? "border-brand-500 bg-brand-50 font-semibold text-brand-600" : "border-line text-ink-muted hover:bg-paper"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </div>
      </div>

      <div className="card divide-y divide-line">
        {shown.length === 0 ? (
          <p className="px-4 sm:px-5 py-5 text-sm text-ink-muted">{t("No templates found matching your search.")}</p>
        ) : shown.map((row) => (
          <div key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 hover:bg-paper sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium">{row.code}</span>
                <span className="stamp border-line text-ink-muted">
                  {row.kind === "quotation" ? t("Quotation") : t("Recruitment")}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{row.name}</p>
              <p className="mt-0.5 truncate text-xs text-ink-faint">{row.detail || "\u00a0"}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
              <Link
                href={row.kind === "quotation" ? `/quotations/new?template=${row.id}` : `/recruitment/new?template=${row.id}`}
                className="btn-primary px-3 py-1 text-xs"
              >
                {t("Use template")}
              </Link>
              <Link
                href={row.kind === "quotation" ? `/quotations/templates/${row.id}/edit` : `/recruitment/new?template=${row.id}&as=template`}
                className="text-xs font-medium text-ink-muted hover:text-brand-600"
              >
                {t("Edit")}
              </Link>
              <DeleteButton
                url={row.kind === "quotation" ? `/api/quotation-templates/${row.id}` : `/api/recruitment-templates/${row.id}`}
                confirmNumber={row.name}
                itemLabel="template"
                redirectTo="/quotations/templates"
              />
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4" onClick={() => setOpen(false)}>
          <form className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} onSubmit={(e) => e.preventDefault()}>
            <h2 className="font-display text-lg font-semibold">{t("New Template")}</h2>
            <label className="label mt-3">{t("Type")}</label>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "quotation" | "recruitment")}>
              <option value="quotation">{t("Quotation")}</option>
              <option value="recruitment">{t("Recruitment")}</option>
            </select>
            <p className="mt-3 text-sm text-ink-muted">
              {kind === "quotation"
                ? t("Quotation templates still use the existing form, with activity name and line items.")
                : t("Recruitment templates use the same agreement form as the Recruitment page.")}
            </p>
            <div className="mt-4 flex gap-2">
              <Link href={kind === "quotation" ? "/quotations/templates/new" : "/recruitment/new?as=template"} className="btn-primary">
                {t("Continue")}
              </Link>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t("Cancel")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
