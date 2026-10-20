"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, AlertCircle } from "lucide-react";
import Portal from "@/components/Portal";
import { useT } from "@/lib/i18n/client";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Kicks off a new payroll run for a chosen calendar month — snapshots
 *  every currently active employee's pay setup into an editable draft (see
 *  POST /api/payroll). If a run for that month already exists, offers to
 *  jump straight to it instead of erroring out. */
export default function NewPayrollRunButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRun() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.id) {
          router.push(`/hr/payroll/${data.id}`);
          return;
        }
        throw new Error(data.error || "Something went wrong.");
      }
      router.push(`/hr/payroll/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} /> {t("New Payroll Run")}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
              onClick={() => !saving && setOpen(false)}
            />
            <div className="relative w-full max-w-sm card p-6 animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">{t("New Payroll Run")}</h2>
                <button
                  type="button"
                  onClick={() => !saving && setOpen(false)}
                  className="text-ink-faint hover:text-ink"
                  aria-label={t("Close")}
                >
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2 mb-4">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{t(error)}</span>
                </div>
              )}

              <label className="label">{t("Pay period")}</label>
              <input
                type="month"
                className="input mb-2"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
              <p className="text-xs text-ink-faint mb-4">
                {t(
                  "Creates a draft with every currently active employee, pre-filled from their pay setup — nothing is final until you review and finalize it."
                )}
              </p>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setOpen(false)} disabled={saving} className="btn-secondary">
                  {t("Cancel")}
                </button>
                <button type="button" onClick={createRun} disabled={saving || !period} className="btn-primary">
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> {t("Creating…")}
                    </>
                  ) : (
                    t("Create run")
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
