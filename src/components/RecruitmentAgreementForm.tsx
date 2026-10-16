"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Plus, Trash2, RotateCcw } from "lucide-react";
import {
  RECRUITMENT_TERMS_TEMPLATES,
  RECRUITMENT_LANGUAGE_LABELS,
  VALID_RECRUITMENT_LANGUAGES,
  translateFeeScaleValue,
  renderRecruitmentTerms,
  buildFeeScaleTables,
  DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS,
  DEFAULT_FEE_SCALE_PERMANENT,
  DEFAULT_FEE_SCALE_CONTRACT,
  type FeeScaleRow,
  type FeeScaleRowFields,
  type RecruitmentLanguage,
} from "@/lib/recruitmentTerms";
import { useT } from "@/lib/i18n/client";

export type RecruitmentAgreementFormData = {
  id: string;
  companyName: string;
  companyEmail: string;
  paymentDueDays: number;
  terms: string;
  feeScalePermanent: FeeScaleRowFields[];
  feeScaleContract: FeeScaleRowFields[];
  language: RecruitmentLanguage;
  /** ISO timestamp already stored for this agreement. Shown as the agreement date. */
  createdAt: string;
};

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/** One fee scale table (Permanent or Contract placements), editable directly
 *  inline — add/edit/delete rows, no separate save step. Belongs entirely to
 *  the agreement being created/edited, same as any other form field. */
function InlineFeeScaleTable({
  title,
  rows,
  onChange,
  language,
}: {
  title: string;
  rows: FeeScaleRowFields[];
  onChange: (rows: FeeScaleRowFields[]) => void;
  language: RecruitmentLanguage;
}) {
  const t = useT();
  function updateRow(index: number, patch: Partial<FeeScaleRowFields>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }
  function addRow() {
    onChange([...rows, { packageLabel: "", fee: "", guaranteePeriod: "" }]);
  }

  return (
    <div>
      <p className="text-xs font-medium text-ink-muted mb-2">{t(title)}</p>
      {rows.length > 0 && (
        <div className="flex gap-2 mb-1 px-0.5">
          <span className="flex-[2] text-[11px] text-ink-faint">{t("Annual Remuneration Package")}</span>
          <span className="flex-1 text-[11px] text-ink-faint">{t("Fee")}</span>
          <span className="flex-1 text-[11px] text-ink-faint">{t("Guarantee Period")}</span>
          <span className="w-9 shrink-0" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="text"
              className="input flex-[2]"
              placeholder={t("e.g. HK$1 mil or below")}
              value={translateFeeScaleValue(row.packageLabel, language)}
              onChange={(e) => updateRow(i, { packageLabel: e.target.value })}
            />
            <input
              type="text"
              className="input flex-1"
              placeholder={t("e.g. 20% of annual salary package")}
              value={translateFeeScaleValue(row.fee, language)}
              onChange={(e) => updateRow(i, { fee: e.target.value })}
            />
            <input
              type="text"
              className="input flex-1"
              placeholder={t("e.g. 12 weeks")}
              value={translateFeeScaleValue(row.guaranteePeriod, language)}
              onChange={(e) => updateRow(i, { guaranteePeriod: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label={t("Remove row")}
              className="p-2 text-ink-faint hover:text-danger-500 transition-colors shrink-0"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="btn-ghost !px-2 text-xs mt-2">
        <Plus size={14} /> {t("Add row")}
      </button>
    </div>
  );
}

export default function RecruitmentAgreementForm({
  agreement,
}: {
  agreement?: RecruitmentAgreementFormData;
}) {
  const t = useT();
  const router = useRouter();
  const [companyName, setCompanyName] = useState(agreement?.companyName || "");
  const [companyEmail, setCompanyEmail] = useState(agreement?.companyEmail || "");
  const [agreementDate, setAgreementDate] = useState(toDateInput(agreement?.createdAt));
  const [paymentDueDays, setPaymentDueDays] = useState(
    agreement?.paymentDueDays ?? DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS
  );
  // Which language the terms clause TEXT is generated in — company data and
  // fee scale row values are unaffected (see the schema comment on
  // RecruitmentAgreement.language). Switching this always re-renders the
  // terms from that language's template, even if termsDirty — a deliberate
  // "start fresh in this language" action, unlike the other auto-sync
  // inputs below which respect a manual edit.
  const [language, setLanguage] = useState<RecruitmentLanguage>(agreement?.language || "EN");

  // Fee scale tables (Clause 13.b) — belong to THIS agreement, edited
  // directly below (same idea as Payment Due Days). A brand-new agreement
  // starts from the built-in defaults, then gets upgraded to the fee scale
  // library's current rates once fetched (see the effect below); editing an
  // existing agreement always starts from what's already stored on it.
  const [permanentRows, setPermanentRows] = useState<FeeScaleRowFields[]>(
    agreement?.feeScalePermanent || DEFAULT_FEE_SCALE_PERMANENT.map((r) => ({ ...r }))
  );
  const [contractRows, setContractRows] = useState<FeeScaleRowFields[]>(
    agreement?.feeScaleContract || DEFAULT_FEE_SCALE_CONTRACT.map((r) => ({ ...r }))
  );
  // Gates the one-time "upgrade to live library defaults" fetch below — once
  // staff has touched a row themselves, that fetch backs off entirely.
  const [rowsTouched, setRowsTouched] = useState(false);

  const feeScaleTables = buildFeeScaleTables({ permanent: permanentRows, contract: contractRows }, language);

  const [terms, setTerms] = useState(
    agreement?.terms ||
      renderRecruitmentTerms(RECRUITMENT_TERMS_TEMPLATES[language], companyName, paymentDueDays, feeScaleTables)
  );
  // Once staff directly edits the terms text, stop overwriting it when
  // company name / payment days / fee scale rows change — same "dirty flag"
  // pattern the Q-I-R system uses for its own terms template.
  const [termsDirty, setTermsDirty] = useState(
    Boolean(agreement?.terms) &&
      agreement!.terms !==
        renderRecruitmentTerms(
          RECRUITMENT_TERMS_TEMPLATES[agreement?.language || "EN"],
          agreement!.companyName,
          agreement!.paymentDueDays,
          feeScaleTables
        )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New agreements only: pick up the fee scale library's current rates
  // instead of staying on the (possibly stale) built-in defaults, as long as
  // staff hasn't started customizing the rows themselves yet.
  useEffect(() => {
    if (agreement) return;
    let cancelled = false;
    fetch("/api/recruitment/fee-scale")
      .then((res) => res.json())
      .then((data: { permanent: FeeScaleRow[]; contract: FeeScaleRow[] }) => {
        if (cancelled || rowsTouched) return;
        const permanent = (data.permanent || []).map(({ packageLabel, fee, guaranteePeriod }) => ({
          packageLabel,
          fee,
          guaranteePeriod,
        }));
        const contract = (data.contract || []).map(({ packageLabel, fee, guaranteePeriod }) => ({
          packageLabel,
          fee,
          guaranteePeriod,
        }));
        setPermanentRows(permanent);
        setContractRows(contract);
        if (!termsDirty) {
          setTerms(
            renderRecruitmentTerms(
              RECRUITMENT_TERMS_TEMPLATES[language],
              companyName,
              paymentDueDays,
              buildFeeScaleTables({ permanent, contract }, language)
            )
          );
        }
      })
      .catch(() => {
        // Library fetch failed — the built-in defaults already rendered above still work.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncTerms(
    nextCompanyName: string,
    nextDays: number,
    nextPermanent: FeeScaleRowFields[],
    nextContract: FeeScaleRowFields[],
    nextLanguage: RecruitmentLanguage = language
  ) {
    if (!termsDirty) {
      setTerms(
        renderRecruitmentTerms(
          RECRUITMENT_TERMS_TEMPLATES[nextLanguage],
          nextCompanyName,
          nextDays,
          buildFeeScaleTables({ permanent: nextPermanent, contract: nextContract }, nextLanguage)
        )
      );
    }
  }

  function handleCompanyNameChange(value: string) {
    setCompanyName(value);
    syncTerms(value, paymentDueDays, permanentRows, contractRows);
  }

  function handlePaymentDueDaysChange(value: number) {
    setPaymentDueDays(value);
    syncTerms(companyName, value, permanentRows, contractRows);
  }

  function handlePermanentRowsChange(rows: FeeScaleRowFields[]) {
    setPermanentRows(rows);
    setRowsTouched(true);
    syncTerms(companyName, paymentDueDays, rows, contractRows);
  }

  function handleContractRowsChange(rows: FeeScaleRowFields[]) {
    setContractRows(rows);
    setRowsTouched(true);
    syncTerms(companyName, paymentDueDays, permanentRows, rows);
  }

  // Deliberately re-renders from the new language's template even if
  // termsDirty — see the `language` state comment above.
  function handleLanguageChange(value: RecruitmentLanguage) {
    setLanguage(value);
    setTermsDirty(false);
    setTerms(
      renderRecruitmentTerms(
        RECRUITMENT_TERMS_TEMPLATES[value],
        companyName,
        paymentDueDays,
        buildFeeScaleTables({ permanent: permanentRows, contract: contractRows }, value)
      )
    );
  }

  async function restoreFeeScaleFromLibrary() {
    try {
      const res = await fetch("/api/recruitment/fee-scale");
      const data: { permanent: FeeScaleRow[]; contract: FeeScaleRow[] } = await res.json();
      const permanent = (data.permanent || []).map(({ packageLabel, fee, guaranteePeriod }) => ({
        packageLabel,
        fee,
        guaranteePeriod,
      }));
      const contract = (data.contract || []).map(({ packageLabel, fee, guaranteePeriod }) => ({
        packageLabel,
        fee,
        guaranteePeriod,
      }));
      setPermanentRows(permanent);
      setContractRows(contract);
      syncTerms(companyName, paymentDueDays, permanent, contract);
    } catch {
      setError(t("Could not load the fee scale library right now."));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = agreement ? `/api/recruitment/${agreement.id}` : "/api/recruitment";
      const res = await fetch(url, {
        method: agreement ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyEmail,
          agreementDate,
          paymentDueDays,
          terms,
          feeScalePermanent: permanentRows,
          feeScaleContract: contractRows,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      router.push(`/recruitment/${data.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Client details")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">{t("Company name *")}</label>
            <input
              type="text"
              className="input"
              placeholder={t("e.g. TechVision Limited")}
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{t("Company email *")}</label>
            <input
              type="email"
              className="input"
              placeholder="hr@example.com"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">{t("Agreement date *")}</label>
            <input
              type="date"
              className="input"
              value={agreementDate}
              onChange={(e) => setAgreementDate(e.target.value)}
              required
            />
            <p className="text-xs text-ink-faint mt-1">
              {t("Printed on the agreement and PDF. An existing agreement keeps its current date until you change it here.")}
            </p>
          </div>
          <div>
            <label className="label">{t("Payment due (days) *")}</label>
            <input
              type="number"
              min={1}
              className="input"
              value={paymentDueDays}
              onChange={(e) => handlePaymentDueDaysChange(parseInt(e.target.value, 10) || 0)}
              required
            />
            <p className="text-xs text-ink-faint mt-1">
              {t("Replaces \"within {days} days\" in Clause 3 of the terms below.")}
            </p>
          </div>
          <div>
            <label className="label">{t("Terms language")}</label>
            <select
              className="input"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as RecruitmentLanguage)}
            >
              {VALID_RECRUITMENT_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {t(RECRUITMENT_LANGUAGE_LABELS[l])}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-faint mt-1">
              {t("Regenerates the terms below in the selected language — same commercial terms either way.")}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-lg font-semibold">{t("Fee scale (Clause 13.b)")}</h2>
          <button
            type="button"
            onClick={restoreFeeScaleFromLibrary}
            className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600"
          >
            <RotateCcw size={12} /> {t("Restore library defaults")}
          </button>
        </div>
        <p className="text-xs text-ink-muted mb-4">
          {t(
            "Pre-filled from the fee scale library's current rates — add, edit, or delete rows here and they'll only apply to this agreement. Changes are reflected in the terms below automatically."
          )}
        </p>
        <div className="flex flex-col gap-5">
          <InlineFeeScaleTable
            title="Fee Scale for Permanent Placements"
            rows={permanentRows}
            onChange={handlePermanentRowsChange}
            language={language}
          />
          <InlineFeeScaleTable
            title="Fee Scale for Contract Placements"
            rows={contractRows}
            onChange={handleContractRowsChange}
            language={language}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold">{t("Terms of business")}</h2>
          {termsDirty && (
            <button
              type="button"
              onClick={() => {
                setTermsDirty(false);
                setTerms(
                  renderRecruitmentTerms(RECRUITMENT_TERMS_TEMPLATES[language], companyName, paymentDueDays, feeScaleTables)
                );
              }}
              className="text-xs text-brand-500 hover:text-brand-600"
            >
              {t("Reset to template")}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-muted mb-3">
          {t(
            "Client company name, payment days, and the fee scale tables above are automatically reflected here — editing this text directly stops that automatic sync."
          )}
        </p>
        <textarea
          className="input min-h-[400px] font-mono text-xs leading-relaxed"
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value);
            setTermsDirty(true);
          }}
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? t("Saving…") : agreement ? t("Save changes") : t("Create agreement")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
