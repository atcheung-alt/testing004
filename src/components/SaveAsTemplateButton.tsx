"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function SaveAsTemplateButton({
  quotationId,
  suggestedName,
}: {
  quotationId: string;
  suggestedName: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggestedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError(t("Give this template a name."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Could not save the template."));
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
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <BookmarkPlus size={15} /> {t("Save as template")}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[280px]">
      <label className="label">{t("Template name")}</label>
      <div className="flex gap-2">
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("e.g. Wellness day package")}
        />
        <button type="button" onClick={save} disabled={saving} className="btn-primary shrink-0">
          {saving ? <Loader2 size={15} className="animate-spin" /> : t("Save")}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="btn-secondary shrink-0"
        >
          {t("Cancel")}
        </button>
      </div>
      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  );
}
