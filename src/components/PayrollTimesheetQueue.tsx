"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type Pending = {
  employeeId: string;
  employeeName: string;
  period: string;
  hours: number;
  days: number;
};

export default function PayrollTimesheetQueue({ items }: { items: Pending[] }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (items.length === 0) return null;

  async function approve(item: Pending) {
    const key = `${item.employeeId}:${item.period}`;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${item.employeeId}/timesheet/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: item.period, action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not approve the hours.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Timesheets waiting")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t("Approve these hours before you run payroll. A draft run for that month picks up the approved days or hours.")}
        </p>
      </div>
      {error && <p className="text-sm text-danger-600">{t(error)}</p>}
      <div className="flex flex-col divide-y divide-line">
        {items.map((item) => {
          const key = `${item.employeeId}:${item.period}`;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="text-sm">
                <Link href={`/hr/employees/${item.employeeId}`} className="font-medium text-brand-600">
                  {item.employeeName}
                </Link>
                <span className="text-ink-muted">
                  {" · "}
                  {item.period}
                  {" · "}
                  {t("{hours} hours across {days} days", { hours: item.hours, days: item.days })}
                </span>
              </div>
              <button type="button" className="btn-primary" disabled={busy === key} onClick={() => approve(item)}>
                {busy === key ? t("Saving…") : t("Approve hours")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
