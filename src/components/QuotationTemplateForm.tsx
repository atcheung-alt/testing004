"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LineItemsEditor, { emptyLineItem } from "@/components/LineItemsEditor";
import DocumentMetaFields from "@/components/DocumentMetaFields";
import {
  DEFAULT_PAYMENT_DUE_DAYS,
  DEFAULT_REMINDER_TEMPLATES,
  DEFAULT_TERMS_TEMPLATES,
  renderTerms,
  type DocumentLanguage,
} from "@/lib/settings";
import type { LineItem } from "@/types";
import { useT } from "@/lib/i18n/client";

export type QuotationTemplateValues = {
  id?: string;
  name: string;
  title: string;
  notes?: string | null;
  terms?: string | null;
  reminder?: string | null;
  paymentDueDays?: number;
  language?: string;
  taxRate?: number;
  discount?: number;
  repeatCount?: number;
  items?: LineItem[];
};

export default function QuotationTemplateForm({ template }: { template?: QuotationTemplateValues }) {
  const t = useT();
  const router = useRouter();
  const initialLanguage = ((template?.language as DocumentLanguage) || "EN") as DocumentLanguage;
  const initialDueDays = template?.paymentDueDays ?? DEFAULT_PAYMENT_DUE_DAYS;

  const [name, setName] = useState(template?.name || "");
  const [title, setTitle] = useState(template?.title || "");
  const [items, setItems] = useState<LineItem[]>(
    template?.items?.length ? template.items.map((item) => ({ ...item })) : [emptyLineItem()]
  );
  const [taxRate, setTaxRate] = useState(template?.taxRate ?? 0);
  const [discount, setDiscount] = useState(template?.discount ?? 0);
  const [repeatCount, setRepeatCount] = useState(template?.repeatCount ?? 1);
  const [notes, setNotes] = useState(template?.notes || "");
  const [language, setLanguage] = useState<DocumentLanguage>(initialLanguage);
  const [paymentDueDays, setPaymentDueDays] = useState(initialDueDays);
  const [reminder, setReminder] = useState(template?.reminder || DEFAULT_REMINDER_TEMPLATES[initialLanguage]);
  const [terms, setTerms] = useState(
    template?.terms || renderTerms(DEFAULT_TERMS_TEMPLATES[initialLanguage], initialDueDays)
  );
  const [termsDirty, setTermsDirty] = useState(Boolean(template?.terms));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePaymentDueDaysChange(days: number) {
    setPaymentDueDays(days);
    if (!termsDirty) setTerms(renderTerms(DEFAULT_TERMS_TEMPLATES[language], days));
  }

  function handleLanguageChange(value: DocumentLanguage) {
    setLanguage(value);
    setTermsDirty(false);
    setTerms(renderTerms(DEFAULT_TERMS_TEMPLATES[value], paymentDueDays));
    setReminder(DEFAULT_REMINDER_TEMPLATES[value]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Give this template a name.");
      return;
    }
    if (items.some((item) => !item.name.trim())) {
      setError("Every line item needs a name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(template?.id ? `/api/quotation-templates/${template.id}` : "/api/quotation-templates", {
        method: template?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          items,
          taxRate,
          discount,
          repeatCount,
          notes,
          reminder,
          terms,
          language,
          paymentDueDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push("/quotations/templates");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
          {t(error)}
        </div>
      )}

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Template name")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("e.g. Wellness day package")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">{t("Activity name")}</label>
          <input
            type="text"
            className="input"
            placeholder={t("Default title — change it each time you use the template")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-ink-muted -mt-2">
        {t("Dates and the customer are filled in when you start a quotation from this template.")}
      </p>

      <div className="card overflow-visible p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Line items")}</h2>
        <LineItemsEditor
          items={items}
          onItemsChange={setItems}
          taxRate={taxRate}
          onTaxRateChange={setTaxRate}
          discount={discount}
          onDiscountChange={setDiscount}
          repeatCount={repeatCount}
          onRepeatCountChange={setRepeatCount}
        />
      </div>

      <DocumentMetaFields
        notes={notes}
        onNotesChange={setNotes}
        paymentDueDays={paymentDueDays}
        onPaymentDueDaysChange={handlePaymentDueDaysChange}
        reminder={reminder}
        onReminderChange={setReminder}
        terms={terms}
        onTermsChange={(value) => {
          setTerms(value);
          setTermsDirty(true);
        }}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t("Saving…") : template?.id ? t("Save template") : t("Create template")}
        </button>
        <button type="button" onClick={() => router.push("/quotations/templates")} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
