"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

type Alert = {
  id: string;
  name: string;
  daysRemaining: number;
  severity: "upcoming" | "overdue";
};

const STORAGE_KEY = "hr-mpf-alert-signature";

export default function MpfNotificationPopup({ alerts }: { alerts: Alert[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alerts.length === 0) return;
    const signature = alerts.map((alert) => `${alert.id}:${alert.daysRemaining}`).join("|");
    if (sessionStorage.getItem(STORAGE_KEY) === signature) return;
    setOpen(true);
  }, [alerts]);

  function dismiss() {
    const signature = alerts.map((alert) => `${alert.id}:${alert.daysRemaining}`).join("|");
    sessionStorage.setItem(STORAGE_KEY, signature);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, alerts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/40" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mpf-alert-title"
        className="card w-full max-w-md p-5 flex flex-col gap-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="mpf-alert-title" className="font-display text-lg font-semibold">
            {t("MPF enrollment reminder")}
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            {t("These full-time employees have 10 days or less left to enroll in MPF.")}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link
                href={`/hr/employees/${alert.id}`}
                onClick={dismiss}
                className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 hover:bg-paper"
              >
                <span className="text-sm font-medium text-ink">{alert.name}</span>
                <span
                  className={`stamp ${
                    alert.severity === "overdue"
                      ? "border-danger-500 text-danger-600 bg-danger-50"
                      : "border-amber-500 text-amber-600 bg-amber-50"
                  }`}
                >
                  {alert.daysRemaining < 0
                    ? t("MPF overdue ({days}d)", { days: Math.abs(alert.daysRemaining) })
                    : alert.daysRemaining === 0
                      ? t("MPF due today")
                      : t("MPF due in {days}d", { days: alert.daysRemaining })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-primary self-end" onClick={dismiss}>
          {t("Got it")}
        </button>
      </div>
    </div>
  );
}
