"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ExternalLink, Pencil, UploadCloud } from "lucide-react";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import SendEmailButton from "@/components/SendEmailButton";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { PAY_BASIS_LABELS, PAY_BASIS_UNIT_LABELS, daysInPeriod, proratedDays, salaryMonthMark } from "@/lib/payroll";
import { payslipEmailContent } from "@/lib/settings";
import { useAppLanguage, useT } from "@/lib/i18n/client";
import { getEmployeeDisplayName } from "@/lib/employeeName";
import type { PayrollEntry } from "@/types";

type Props = {
  runId: string;
  entries: PayrollEntry[];
  period: string;
  periodLabel: string;
  companyName: string;
};

/** Local, debounce-free "committed on blur/change" editing — every field
 *  edit fires its own PATCH and the row re-renders from whatever the server
 *  actually computed (gross/MPF/net are always server-derived, never
 *  duplicated client-side), same philosophy as computeTotals elsewhere in
 *  this app never being trusted from client input. Runs stay editable
 *  indefinitely — there's no "finalize and lock" step anymore. */
export default function PayrollRunEntries({ runId, entries: initialEntries, period, periodLabel, companyName }: Props) {
  const t = useT();
  const language = useAppLanguage();
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState<{ id: string; name: string; paid: boolean } | null>(null);
  const [confirmMpf, setConfirmMpf] = useState<{ id: string; month: string; on: boolean } | null>(null);
  const [editingDaysId, setEditingDaysId] = useState<string | null>(null);

  async function patchEntry(entryId: string, patch: Record<string, unknown>) {
    setSavingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/${runId}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save that change.");
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...data } : e)));
      if ("paid" in patch) router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function syncToDrive() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/payroll/${runId}/drive-sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not sync to Google Drive.");
      if (data.driveWarning) setError(data.driveWarning);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const totals = entries.reduce(
    (sum, e) => ({
      gross: sum.gross + e.grossPay,
      bonus: sum.bonus + (e.bonus || 0),
      employeeMpf: sum.employeeMpf + e.employeeMpf,
      employerMpf: sum.employerMpf + e.employerMpf,
      net: sum.net + e.netPay,
    }),
    { gross: 0, bonus: 0, employeeMpf: 0, employerMpf: 0, net: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          {t(error)}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-3">{t("Employee")}</th>
              <th className="px-4 py-3">{t("Paid")}</th>
              <th className="px-4 py-3">{t("Pay basis")}</th>
              <th className="px-4 py-3">{t("Rate")}</th>
              <th className="px-4 py-3">{t("Units worked")}</th>
              <th className="px-4 py-3">{t("Gross pay")}</th>
              <th className="px-4 py-3">{t("Bonus")}</th>
              <th className="px-4 py-3">{t("MPF applies")}</th>
              <th className="px-4 py-3">{t("Employee MPF")}</th>
              <th className="px-4 py-3">{t("Net pay")}</th>
              <th className="px-4 py-3">{t("Payslip")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const unitLabel = PAY_BASIS_UNIT_LABELS[entry.payBasis];
              const editableUnits = entry.payBasis === "DAILY" || entry.payBasis === "HOURLY";
              const rowSaving = savingId === entry.id;
              const email = payslipEmailContent({
                employeeName: entry.employeeName,
                periodLabel,
                companyName,
                language,
              });
              const started = entry.startDate ? new Date(entry.startDate) : null;
              const monthMark = entry.payBasis === "SALARY" ? salaryMonthMark(started, period) : null;
              const monthDays = monthMark === "prorated" && started ? proratedDays(started, period).monthDays : daysInPeriod(period);
              const shownDays = monthMark === "prorated" ? entry.unitsWorked : monthDays;
              return (
                <tr id={`payroll-${entry.id}`} key={entry.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">
                      {getEmployeeDisplayName({
                        name: entry.employeeName,
                        preferredName: entry.preferredName,
                        nickname: entry.nickname,
                        nameChinese: entry.nameChinese,
                      })}
                    </p>
                    <p className="text-xs text-ink-muted">{entry.employeeTitle}</p>
                    {monthMark === "prorated" && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {t("PRORATED ({days}/{total} days)", { days: shownDays, total: monthDays })}
                        <button
                          type="button"
                          className="text-blue-700"
                          title={t("Edit days")}
                          onClick={() => setEditingDaysId(editingDaysId === entry.id ? null : entry.id)}
                        >
                          <Pencil size={11} />
                        </button>
                      </span>
                    )}
                    {monthMark === "first-full" && (
                      <span className="mt-1 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {t("1ST FULL MONTH ({days}/{total} days)", { days: monthDays, total: monthDays })}
                      </span>
                    )}
                    {editingDaysId === entry.id && monthMark === "prorated" && (
                      <label className="mt-1 block text-[11px] text-ink-muted">
                        {t("Edit days")}
                        <input
                          type="number"
                          min={0}
                          max={monthDays}
                          className="input ml-1 w-16 py-0.5 text-xs"
                          defaultValue={entry.unitsWorked}
                          onBlur={(e) => {
                            const value = Math.max(0, Math.min(monthDays, parseFloat(e.target.value) || 0));
                            setEditingDaysId(null);
                            if (value !== entry.unitsWorked) patchEntry(entry.id, { unitsWorked: value });
                          }}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        entry.paidAt
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                      onClick={() =>
                        setConfirmPaid({
                          id: entry.id,
                          name: getEmployeeDisplayName({
                            name: entry.employeeName,
                            preferredName: entry.preferredName,
                            nickname: entry.nickname,
                            nameChinese: entry.nameChinese,
                          }),
                          paid: !entry.paidAt,
                        })
                      }
                    >
                      {entry.paidAt ? t("PAID") : t("UNPAID")}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{t(PAY_BASIS_LABELS[entry.payBasis] || entry.payBasis)}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      className="input w-28"
                      defaultValue={entry.rate}
                      onBlur={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        if (value !== entry.rate) patchEntry(entry.id, { rate: value });
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {editableUnits ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          className="input w-20"
                          defaultValue={entry.unitsWorked}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            if (value !== entry.unitsWorked) patchEntry(entry.id, { unitsWorked: value });
                          }}
                        />
                        <span className="text-xs text-ink">{t(unitLabel)}</span>
                        <span className="text-xs text-ink">· {entry.employerName || t("HR Plus")}</span>
                      </div>
                    ) : (
                      <span className="text-ink">
                        {entry.payBasis === "DAILY" || entry.payBasis === "HOURLY"
                          ? `${entry.unitsWorked} ${t(unitLabel)} · ${entry.employerName || t("HR Plus")}`
                          : entry.employerName || t("HR Plus")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {formatCurrency(entry.grossPay)}
                    {monthMark === "prorated" && (
                      <p className="mt-1 text-[11px] font-sans font-normal text-ink-muted">
                        {t("({days}/{total} days × {amount})", {
                          days: shownDays,
                          total: monthDays,
                          amount: formatCurrency(entry.rate),
                        })}
                      </p>
                    )}
                    {monthMark === "first-full" && (
                      <p className="mt-1 text-[11px] font-sans font-normal text-ink-muted">
                        {t("({days}/{total} days × {amount})", {
                          days: monthDays,
                          total: monthDays,
                          amount: formatCurrency(entry.rate),
                        })}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.employmentType === "FULL_TIME" ? (
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="input w-24"
                        defaultValue={entry.bonus}
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (value !== entry.bonus) patchEntry(entry.id, { bonus: value });
                        }}
                      />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={`text-sm font-semibold ${entry.mpfApplicable ? "text-emerald-700" : "text-ink-muted"}`}
                      onClick={() => setConfirmMpf({ id: entry.id, month: periodLabel, on: !entry.mpfApplicable })}
                    >
                      {entry.mpfApplicable ? t("Yes") : t("No")}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(entry.employeeMpf)}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(entry.netPay)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 items-start">
                      <div className="flex gap-1.5">
                        <DownloadPdfButton url={`/api/payroll/${runId}/entries/${entry.id}/pdf`} />
                        <SendEmailButton
                          kind="employees"
                          id={entry.id}
                          endpoint={`/api/payroll/${runId}/entries/${entry.id}/email`}
                          defaultTo={entry.employeeEmail || ""}
                          defaultSubject={email.subject}
                          defaultBody={email.body}
                          emailValid={Boolean(entry.employeeEmail)}
                          label="Send"
                        />
                      </div>
                      {entry.payslipSentAt ? (
                        <span className="flex items-center gap-1 text-[11px] text-brand-600">
                          <CheckCircle2 size={11} /> {t("Sent {date}", { date: formatDate(entry.payslipSentAt) })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">{t("Not sent yet")}</span>
                      )}
                      {entry.driveFileUrl && (
                        <a
                          href={entry.driveFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink"
                        >
                          <ExternalLink size={11} /> {t("On Drive")}
                        </a>
                      )}
                      {rowSaving && (
                        <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                          <Loader2 size={10} className="animate-spin" /> {t("Saving…")}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-brand-50/40 font-semibold">
              <td className="px-4 py-3" colSpan={5}>
                {t("Totals")}
              </td>
              <td className="px-4 py-3 font-mono">{formatCurrency(totals.gross)}</td>
              <td className="px-4 py-3 font-mono">{formatCurrency(totals.bonus)}</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3 font-mono">{formatCurrency(totals.employeeMpf)}</td>
              <td className="px-4 py-3 font-mono">{formatCurrency(totals.net)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-ink-faint">
        {t(
          "Employer MPF contributions this run (paid separately, not deducted from anyone's pay): {amount}.",
          { amount: formatCurrency(totals.employerMpf) }
        )}
      </p>

      <div className="flex justify-end">
        <button type="button" onClick={syncToDrive} disabled={syncing} className="btn-secondary">
          {syncing ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {t("Syncing…")}
            </>
          ) : (
            <>
              <UploadCloud size={15} /> {t("Sync to Drive")}
            </>
          )}
        </button>
      </div>
      {confirmMpf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              {confirmMpf.on ? t("Turn employee MPF on?") : t("Turn employee MPF off?")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              {confirmMpf.on
                ? t("{month} will deduct 5% from this pay.", { month: confirmMpf.month })
                : t("{month} will not deduct employee MPF.", { month: confirmMpf.month })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmMpf(null)}>
                {t("Not now")}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  patchEntry(confirmMpf.id, { mpfApplicable: confirmMpf.on });
                  setConfirmMpf(null);
                }}
              >
                {confirmMpf.on ? t("Yes, turn on") : t("Yes, turn off")}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmPaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              {confirmPaid.paid ? t("Mark this person as paid?") : t("Change back to unpaid?")}
            </h2>
            <p className="mt-3 font-medium text-ink">{confirmPaid.name}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {confirmPaid.paid
                ? t("This records them as paid for {period}. You can undo it afterwards.", { period: periodLabel })
                : t("They will show as still to pay. You can mark them paid again later.")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmPaid(null)}>
                {t("Not now")}
              </button>
              <button
                type="button"
                className={confirmPaid.paid ? "btn-primary" : "btn-secondary text-rose-700"}
                onClick={() => {
                  patchEntry(confirmPaid.id, { paid: confirmPaid.paid });
                  setConfirmPaid(null);
                }}
              >
                {confirmPaid.paid ? t("Yes, mark paid") : t("Yes, mark unpaid")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
