"use client";

import { useState } from "react";
import { CalendarDays, Send, Loader2, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/calculations";
import LeaveStatusBadge from "@/components/LeaveStatusBadge";
import CompanyLogo from "@/components/CompanyLogo";
import type { PublicEmployeeLeaveView } from "@/lib/publicEmployeeLeave";
import { useT } from "@/lib/i18n/client";

function CompanyHeader({ company }: { company: PublicEmployeeLeaveView["company"] }) {
  return (
    <div className="flex justify-end mb-2">
      {company.logoData ? (
        <CompanyLogo
          logoData={company.logoData}
          logoDataDark={company.logoDataDark}
          name={company.name}
          className="h-9 object-contain"
        />
      ) : (
        <span className="font-display text-xl font-semibold text-brand-800">{company.name}</span>
      )}
    </div>
  );
}

export default function EmployeeLeaveClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicEmployeeLeaveView;
}) {
  const [view, setView] = useState(initial);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<"AM" | "PM">("AM");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const t = useT();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustSubmitted(false);

    if (!startDate) {
      setError(t("Please choose a start date."));
      return;
    }
    if (endDate && endDate < startDate) {
      setError(t("End date must be on or after the start date."));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/leave/${token}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate: isHalfDay ? startDate : endDate || startDate,
          isHalfDay,
          halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong. Please try again."));
      setView(data);
      setStartDate("");
      setEndDate("");
      setIsHalfDay(false);
      setHalfDayPeriod("AM");
      setReason("");
      setJustSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
      <CompanyHeader company={view.company} />

      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{t("Hi, {name}", { name: view.name })}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{t("Your annual leave balance and request history.")}</p>
      </div>

      <div className="card p-5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
{t("Entitlement")}
          </p>
          <p className="font-mono text-xl font-semibold text-ink">{view.annualLeaveDays}</p>
          <p className="text-xs text-ink-faint">{t("days/year")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">{t("Used")}</p>
          <p className="font-mono text-xl font-semibold text-ink">{view.leaveUsed}</p>
          <p className="text-xs text-ink-faint">{t("days")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
{t("Remaining")}
          </p>
          <p
            className={`font-mono text-xl font-semibold ${view.leaveRemaining < 0 ? "text-danger-500" : "text-brand-600"}`}
          >
            {view.leaveRemaining}
          </p>
          <p className="text-xs text-ink-faint">{t("days")}</p>
        </div>
      </div>

      {view.canRequestLeave ? (
        <form onSubmit={submit} className="card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-brand-600" />
            <h2 className="font-display text-lg font-semibold">{t("Request Leave")}</h2>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {justSubmitted && (
            <div className="bg-emerald-50 border border-emerald-500/30 text-emerald-700 text-sm rounded-xl px-3 py-2">
{t("Request submitted — a staff member will review it soon.")}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("Start date *")}</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("End date")}</label>
              <input
                type="date"
                className="input"
                value={endDate}
                min={startDate || undefined}
                disabled={isHalfDay}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-faint">{t("Leave blank for a single day.")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(e) => {
                  setIsHalfDay(e.target.checked);
                  if (e.target.checked) setEndDate("");
                }}
              />
              <span>{t("Half day (counts as 0.5 day)")}</span>
            </label>
            {isHalfDay && (
              <div className="flex gap-4 pl-6">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="halfDayPeriod"
                    checked={halfDayPeriod === "AM"}
                    onChange={() => setHalfDayPeriod("AM")}
                  />
{t("Morning (AM)")}
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="halfDayPeriod"
                    checked={halfDayPeriod === "PM"}
                    onChange={() => setHalfDayPeriod("PM")}
                  />
{t("Afternoon (PM)")}
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="label">{t("Reason (optional)")}</label>
            <textarea
              className="input min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
placeholder={t("e.g. Family trip")}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary self-start">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? t("Submitting…") : t("Submit request")}
          </button>
        </form>
      ) : (
        <div className="card p-5 text-sm text-ink-muted text-center">
{t("This link is read-only — new leave requests can no longer be submitted.")}
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg font-semibold mb-4">{t("Request History")}</h2>
        {view.leaveRequests.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No leave requests yet.")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {view.leaveRequests.map((r) => (
              <div key={r.id} className="py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {formatDate(r.startDate)}
                    {r.endDate !== r.startDate ? ` – ${formatDate(r.endDate)}` : ""}
                    {r.isHalfDay && (
                      <span className="text-xs font-normal text-ink-muted">
                        {" "}
                        ({t("{period} half-day · 0.5 day", { period: t(r.halfDayPeriod || "") })})
                      </span>
                    )}
                  </p>
                  <LeaveStatusBadge status={r.status} />
                </div>
                {r.reason && <p className="text-xs text-ink-muted">{r.reason}</p>}
                {r.decidedNote && <p className="text-xs text-ink-faint italic">{t("Note: {note}", { note: r.decidedNote })}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
