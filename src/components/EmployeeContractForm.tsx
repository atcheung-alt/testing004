"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, RotateCcw } from "lucide-react";
import {
  contractTermsTemplateFor,
  renderEmployeeContractTerms,
  remunerationClause,
  greetingName,
} from "@/lib/employeeContractTerms";
import { formatDate } from "@/lib/calculations";
import { useT } from "@/lib/i18n/client";

export type EmployeeContractFormData = {
  id: string;
  terms: string;
  probationPeriod: string | null;
  contractEndDate: string | null;
  workLocation: string | null;
  workSchedule: string | null;
};

export default function EmployeeContractForm({
  employeeId,
  employeeName,
  employeeTitle,
  salary,
  employmentType,
  payRateType,
  payRate,
  annualLeaveDays,
  startDate,
  hkid,
  employeeAddress,
  gender,
  companyName,
  companyAddress,
  contract,
}: {
  employeeId: string;
  employeeName: string;
  employeeTitle: string;
  salary: number;
  employmentType?: string | null;
  payRateType?: string | null;
  payRate?: number;
  annualLeaveDays: number;
  startDate: string | null;
  hkid?: string | null;
  employeeAddress?: string | null;
  gender?: string | null;
  companyName: string;
  companyAddress?: string | null;
  contract?: EmployeeContractFormData;
}) {
  const router = useRouter();
  const t = useT();
  // Intern and Part time share the same shorter letter shape — see
  // contractTermsTemplateFor/PART_TIME_CONTRACT_TERMS_TEMPLATE — with no
  // probation period or fixed end date (flat 7-day notice instead), so
  // those two inputs are hidden for both. Freelancers get their own
  // Independent Contractor Agreement, likewise open-ended with no
  // probation/end date, and its agreement also has no Working Hours/
  // Working Location clause at all (a contractor sets their own), so that
  // whole card is hidden for them too.
  const isIntern = employmentType === "INTERN";
  const isPartTime = employmentType === "PART_TIME";
  const isFreelance = employmentType === "FREELANCE";
  // True for any employment type whose letter has no Probation/Contract
  // Duration clause to fill in.
  const hidesProbationAndEndDate = isIntern || isPartTime || isFreelance;
  const template = contractTermsTemplateFor(employmentType);
  const [probationPeriod, setProbationPeriod] = useState(contract?.probationPeriod || "3 months");
  const [contractEndDate, setContractEndDate] = useState(
    contract?.contractEndDate ? contract.contractEndDate.slice(0, 10) : ""
  );
  const [workLocation, setWorkLocation] = useState(contract?.workLocation || "");
  const [workSchedule, setWorkSchedule] = useState(
    contract?.workSchedule ||
      (isIntern || isPartTime ? "10:00am–7:00pm, Monday to Friday" : "Mon–Fri, 9:30am–6:30pm")
  );

  function buildValues(nextProbation: string, nextEndDate: string, nextLocation: string, nextSchedule: string) {
    return {
      employeeName,
      greetingName: greetingName(employeeName, gender),
      companyName,
      companyAddress: companyAddress || "",
      employeeAddress: employeeAddress || "",
      hkid: hkid || "",
      title: employeeTitle,
      startDate: startDate ? formatDate(startDate) : "________",
      remuneration: remunerationClause({
        employmentType: employmentType || null,
        salary,
        payRateType: payRateType || null,
        payRate: payRate || 0,
      }),
      annualLeaveDays: annualLeaveDays ? String(annualLeaveDays) : "________",
      probationPeriod: nextProbation,
      // Appended straight onto the Contract Duration sentence — empty for a
      // permanent position, so nothing extra is shown at all (see
      // OPTIONAL_PLACEHOLDER_KEYS in employeeContractTerms.ts).
      contractEndDate: nextEndDate ? ` This is a fixed-term contract ending on ${formatDate(nextEndDate)}.` : "",
      workLocation: nextLocation,
      workSchedule: nextSchedule,
    };
  }

  const [terms, setTerms] = useState(
    contract?.terms ||
      renderEmployeeContractTerms(
        template,
        buildValues(probationPeriod, contractEndDate, workLocation, workSchedule)
      )
  );
  const [termsDirty, setTermsDirty] = useState(
    Boolean(contract?.terms) &&
      contract!.terms !==
        renderEmployeeContractTerms(
          template,
          buildValues(
            contract!.probationPeriod || "",
            contract!.contractEndDate || "",
            contract!.workLocation || "",
            contract!.workSchedule || ""
          )
        )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function syncTerms(nextProbation: string, nextEndDate: string, nextLocation: string, nextSchedule: string) {
    if (!termsDirty) {
      setTerms(
        renderEmployeeContractTerms(
          template,
          buildValues(nextProbation, nextEndDate, nextLocation, nextSchedule)
        )
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/contract`, {
        method: contract ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms,
          probationPeriod,
          contractEndDate: contractEndDate || null,
          workLocation,
          workSchedule,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong."));
      router.push(`/hr/employees/${employeeId}`);
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
          <span>{error}</span>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Contract Details")}</h2>
        {(isIntern || isPartTime) && (
          <p className="text-xs text-ink-faint mb-4">
            {isIntern
              ? t("The intern letter has a flat 7-day notice period and no fixed end date, so those fields aren't shown here.")
              : t("The part-time letter has a flat 7-day notice period and no fixed end date, so those fields aren't shown here.")}
          </p>
        )}
        {isFreelance ? (
          <p className="text-xs text-ink-faint">{t("The Independent Contractor Agreement has no probation period, fixed end date, or working hours/location clause — a contractor sets their own. Nothing to fill in here; edit the letter directly below if it needs a change.")}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!hidesProbationAndEndDate && (
              <>
                <div>
                  <label className="label">{t("Probation period")}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder={t("e.g. 3 months")}
                    value={probationPeriod}
                    onChange={(e) => {
                      setProbationPeriod(e.target.value);
                      syncTerms(e.target.value, contractEndDate, workLocation, workSchedule);
                    }}
                  />
                </div>
                <div>
                  <label className="label">{t("Contract end date")}</label>
                  <input
                    type="date"
                    className="input"
                    value={contractEndDate}
                    onChange={(e) => {
                      setContractEndDate(e.target.value);
                      syncTerms(probationPeriod, e.target.value, workLocation, workSchedule);
                    }}
                  />
                  <p className="text-xs text-ink-faint mt-1">{t("Leave blank for a permanent position.")}</p>
                </div>
              </>
            )}
            <div>
              <label className="label">{t("Work location")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. Hong Kong office")}
                value={workLocation}
                onChange={(e) => {
                  setWorkLocation(e.target.value);
                  syncTerms(probationPeriod, contractEndDate, e.target.value, workSchedule);
                }}
              />
            </div>
            <div>
              <label className="label">{t("Working hours / schedule")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. Mon–Fri, 9:30am–6:30pm")}
                value={workSchedule}
                onChange={(e) => {
                  setWorkSchedule(e.target.value);
                  syncTerms(probationPeriod, contractEndDate, workLocation, e.target.value);
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-semibold">{t("Contract Letter")}</h2>
          {termsDirty && (
            <button
              type="button"
              onClick={() => {
                setTermsDirty(false);
                setTerms(
                  renderEmployeeContractTerms(
                    template,
                    buildValues(probationPeriod, contractEndDate, workLocation, workSchedule)
                  )
                );
              }}
              className="text-xs text-brand-500 hover:text-brand-600"
            >
              <RotateCcw size={12} className="inline mr-1" /> {t("Reset to template")}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-muted mb-3">{t("Auto-filled from the fields above and the employee's title/pay/leave entitlement — editing this text directly stops that automatic sync.")}</p>
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
          {saving ? t("Saving…") : contract ? t("Save changes") : t("Create contract")}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}
