"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Mail } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { summarizeSlots, unitsFromSlots, type TimesheetBasis, type TimesheetStatus, type WorkSheet } from "@/lib/timesheetMath";

const STATUS_TEXT: Record<TimesheetStatus, string> = {
  SENT: "Link sent",
  SUBMITTED: "Hours submitted",
  APPROVED: "Hours approved",
  REJECTED: "Sent back to the worker",
};

export default function EmployeeTimesheetCard({
  employeeId,
  basis,
  hasEmail,
  initialPeriod,
  sheets,
}: {
  employeeId: string;
  basis: TimesheetBasis;
  hasEmail: boolean;
  initialPeriod: string;
  sheets: WorkSheet[];
}) {
  const t = useT();
  const router = useRouter();
  const [period, setPeriod] = useState(initialPeriod);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = sheets.find((sheet) => sheet.period === period) || null;

  async function sendLink() {
    setBusy("send");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/timesheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the timesheet link.");
      setLink(data.url || null);
      setNotice(
        data.emailed
          ? "The timesheet link was emailed."
          : data.emailError || "The link is ready. Copy it if the email did not go out."
      );
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function decide(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/timesheet/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the timesheet.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const summary = current ? summarizeSlots(current.slots) : null;
  const units = current ? unitsFromSlots(basis, current.slots) : 0;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Work timesheet")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t(
            "Full-time staff are paid a monthly salary, so they do not fill in days. This worker is paid by the {unit}. Email one link for the month. They enter each day and the start and end time. Approve it, and that month's payroll uses these {unit} instead of a guess.",
            { unit: basis === "DAILY" ? t("days") : t("hours") }
          )}
        </p>
      </div>
      {error && <p className="text-sm text-danger-600">{t(error)}</p>}
      {notice && <p className="text-sm text-ink-muted">{t(notice)}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor="timesheet-period">
            {t("Month")}
          </label>
          <input
            id="timesheet-period"
            className="input"
            type="month"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setLink(null);
              setNotice(null);
            }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={sendLink} disabled={!!busy || !hasEmail}>
          {busy === "send" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
          {t("Email timesheet link")}
        </button>
      </div>
      {!hasEmail && (
        <p className="text-xs text-danger-600">{t("Add an email on the employee record before sending the link.")}</p>
      )}
      {link && (
        <div className="flex flex-wrap items-center gap-2">
          <input className="input text-xs" readOnly value={link} />
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(link)}>
            <Copy size={15} /> {t("Copy link")}
          </button>
        </div>
      )}
      {current && summary && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-sm">
            <span className="font-medium">{t(STATUS_TEXT[current.status])}</span>
            {" · "}
            {t("{hours} hours across {days} days", { hours: summary.hours, days: summary.days })}
            {" · "}
            {t("Payroll will use {units}.", {
              units: basis === "DAILY" ? t("{count} days", { count: units }) : t("{count} hours", { count: units }),
            })}
          </p>
          {current.note && <p className="text-sm text-ink-muted">{current.note}</p>}
          {current.slots.length > 0 && (
            <ul className="text-sm text-ink-muted flex flex-col gap-1">
              {current.slots.map((slot, index) => (
                <li key={`${slot.date}-${slot.start}-${index}`}>
                  {slot.date} · {slot.start}–{slot.end}
                </li>
              ))}
            </ul>
          )}
          {(current.status === "SUBMITTED" || current.status === "REJECTED") && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={!!busy} onClick={() => decide("approve")}>
                {busy === "approve" ? t("Saving…") : t("Approve hours")}
              </button>
              <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => decide("reject")}>
                {busy === "reject" ? t("Saving…") : t("Send back")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
