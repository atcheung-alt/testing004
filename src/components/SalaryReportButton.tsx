"use client";

import { useState } from "react";
import { FileDown, X, AlertCircle } from "lucide-react";
import Portal from "@/components/Portal";
import { currentPeriod } from "@/lib/payroll";
import { useAppLanguage, useT } from "@/lib/i18n/client";
import { appLanguageToPdf } from "@/lib/i18n/language";
import type { PdfDownloadLanguage } from "@/lib/pdf/language";

/** Opens a small "pick a date range" modal, then downloads a PDF salary
 *  report for this employee covering every payroll run in that range (see
 *  GET /api/employees/[id]/salary-report/pdf). The PDF language follows the
 *  Language button. Nothing is saved on the employee. */
export default function SalaryReportButton({ employeeId }: { employeeId: string }) {
  const t = useT();
  const language = useAppLanguage();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(currentPeriod());
  const [to, setTo] = useState(currentPeriod());
  const [pdfLanguage, setPdfLanguage] = useState<PdfDownloadLanguage>(appLanguageToPdf(language));
  const [error, setError] = useState<string | null>(null);

  function download() {
    if (!from || !to) {
      setError(t("Please choose both a start and end month."));
      return;
    }
    if (from > to) {
      setError(t("The start month must be on or before the end month."));
      return;
    }
    setError(null);
    window.open(
      `/api/employees/${employeeId}/salary-report/pdf?from=${from}&to=${to}&lang=${pdfLanguage}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <FileDown size={15} /> {t("Salary report")}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-sm card p-6 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">{t("Export Salary Report")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-ink-faint hover:text-ink"
                  aria-label={t("Close")}
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2 mb-4">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="label">{t("From")}</label>
                  <input type="month" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <label className="label">{t("To")}</label>
                  <input type="month" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="mb-3">
                <label className="label">{t("PDF language")}</label>
                <div className="inline-flex rounded-md border border-line overflow-hidden">
                  {(
                    [
                      ["EN", "English PDF"],
                      ["ZH_HANT", "Chinese PDF"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPdfLanguage(value)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        pdfLanguage === value ? "bg-brand-600 text-white" : "bg-surface text-ink hover:bg-brand-50"
                      }`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-ink-faint mb-4">
                {t(
                  "Covers every payroll run in this range — income, bonus, and MPF (employee and employer) per month, plus totals."
                )}
              </p>

              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={download}
                  disabled={!from || !to}
                  className="btn-secondary whitespace-nowrap"
                >
                  <FileDown size={15} /> {t("Download PDF")}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
