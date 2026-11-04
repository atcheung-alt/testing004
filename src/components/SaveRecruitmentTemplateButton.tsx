"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function SaveRecruitmentTemplateButton({
  suggestedName = "",
  role = "",
  requirements = "",
  paymentDueDays,
  language,
  terms,
  feeScalePermanent,
  feeScaleContract,
}: {
  suggestedName?: string;
  role?: string;
  requirements?: string;
  paymentDueDays?: number;
  language?: string;
  terms?: string;
  feeScalePermanent?: { packageLabel: string; fee: string; guaranteePeriod: string }[];
  feeScaleContract?: { packageLabel: string; fee: string; guaranteePeriod: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [jobRole, setJobRole] = useState(role);
  const [notes, setNotes] = useState(requirements);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError(t("Give this template a name."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/recruitment-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: jobRole,
          requirements: notes,
          paymentDueDays,
          language,
          terms,
          feeScalePermanent,
          feeScaleContract,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("Could not save the template."));
      setOpen(false);
      router.push("/quotations/templates");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => { setName(suggestedName); setJobRole(role); setNotes(requirements); setOpen(true); }}>
        <BookmarkPlus size={15} /> {t("Save as template")}
      </button>
    );
  }

  return (
    <div className="card w-full p-4 sm:min-w-[320px]">
      <label className="label">{t("Template name")}</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label mt-3">{t("Job role")}</label>
      <input className="input" value={jobRole} onChange={(e) => setJobRole(e.target.value)} />
      <label className="label mt-3">{t("Requirements")}</label>
      <textarea className="input min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error ? <p className="mt-2 text-xs text-danger-500">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : t("Save")}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{t("Cancel")}</button>
      </div>
    </div>
  );
}
