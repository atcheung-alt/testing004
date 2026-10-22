"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/client";

type Slot = { date: string; start: string; end: string };

type View = {
  employeeName: string;
  period: string;
  status: "SENT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  note: string;
  slots: Slot[];
  basis: "DAILY" | "HOURLY";
  hours: number;
  days: number;
};

function monthEnd(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

function emptySlot(period: string): Slot {
  return { date: `${period}-01`, start: "09:00", end: "18:00" };
}

export default function TimesheetForm({
  token,
  initial,
  embedded = false,
}: {
  token: string;
  initial: View;
  embedded?: boolean;
}) {
  const t = useT();
  const [view, setView] = useState(initial);
  const [slots, setSlots] = useState<Slot[]>(initial.slots.length ? initial.slots : [emptySlot(initial.period)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = view.status === "APPROVED";

  function update(index: number, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/timesheet/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the hours.");
      setView(data);
      setSlots(data.slots?.length ? data.slots : slots);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className={embedded ? "card p-5 flex flex-col gap-4" : "max-w-lg mx-auto px-4 py-10 flex flex-col gap-4"}>
      <div>
        {embedded ? (
          <h2 className="font-display text-lg font-semibold text-ink">{t("Days and times you worked")}</h2>
        ) : (
          <h1 className="font-display text-2xl font-semibold text-ink">{t("Fill in the days you worked")}</h1>
        )}
        <p className="text-sm text-ink-muted mt-1">
          {embedded
            ? t("Add each day with a start and end time. HR Plus approves this before it is used.")
            : `${view.employeeName} · ${view.period}`}
        </p>
      </div>
      <div className={embedded ? "flex flex-col gap-3" : "card p-5 flex flex-col gap-3"}>
        {view.status === "APPROVED" && <p className="text-sm text-ink">{t("These hours are approved and locked.")}</p>}
        {view.status === "SUBMITTED" && (
          <p className="text-sm text-ink-muted">
            {t("Hours submitted. HR Plus will check them before pay is processed.")}
          </p>
        )}
        {view.status === "REJECTED" && view.note && <p className="text-sm text-danger-600">{view.note}</p>}
        {error && <p className="text-sm text-danger-600">{t(error)}</p>}
        <div className="flex flex-col gap-2">
          {slots.map((slot, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_7rem_auto] gap-2 items-end">
              <div>
                {index === 0 && <label className="label">{t("Day")}</label>}
                <input
                  className="input"
                  type="date"
                  required
                  min={`${view.period}-01`}
                  max={monthEnd(view.period)}
                  value={slot.date}
                  disabled={locked}
                  onChange={(event) => update(index, { date: event.target.value })}
                />
              </div>
              <div>
                {index === 0 && <label className="label">{t("Start time")}</label>}
                <input
                  className="input"
                  type="time"
                  required
                  value={slot.start}
                  disabled={locked}
                  onChange={(event) => update(index, { start: event.target.value })}
                />
              </div>
              <div>
                {index === 0 && <label className="label">{t("End time")}</label>}
                <input
                  className="input"
                  type="time"
                  required
                  value={slot.end}
                  disabled={locked}
                  onChange={(event) => update(index, { end: event.target.value })}
                />
              </div>
              {!locked && (
                <button
                  type="button"
                  className="text-ink-faint hover:text-danger-500 pb-2"
                  aria-label={t("Remove day")}
                  onClick={() => setSlots((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSlots((current) => [...current, emptySlot(view.period)])}
            >
              <Plus size={15} /> {t("Add a day")}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t("Saving…") : t("Submit hours")}
            </button>
          </div>
        )}
        <p className="text-xs text-ink-muted">
          {t("{hours} hours across {days} days", { hours: view.hours, days: view.days })}
        </p>
      </div>
    </form>
  );
}
