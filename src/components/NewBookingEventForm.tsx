"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { readJsonOrThrow } from "@/lib/bookingFormat";
import { useT } from "@/lib/i18n/client";

export default function NewBookingEventForm() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fromTime, setFromTime] = useState("10:00");
  const [untilTime, setUntilTime] = useState("13:00");
  const [durationMins, setDurationMins] = useState("30");
  const [seats, setSeats] = useState("2");
  const [requiresConfirmation, setRequiresConfirmation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, description, startDate, endDate, requiresConfirmation }),
      });
      const data = await readJsonOrThrow(res, "Could not create this event.");
      const lastDay = endDate || startDate;
      const days: string[] = [];
      const cursor = new Date(`${startDate}T00:00:00`);
      const stop = new Date(`${lastDay}T00:00:00`);
      while (cursor.getTime() <= stop.getTime()) {
        const month = String(cursor.getMonth() + 1).padStart(2, "0");
        const day = String(cursor.getDate()).padStart(2, "0");
        days.push(`${cursor.getFullYear()}-${month}-${day}`);
        cursor.setDate(cursor.getDate() + 1);
        if (days.length > 31) break;
      }
      for (const date of days) {
        const slots = await fetch(`/api/bookings/events/${data.id}/slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "bulk",
            date,
            startTime: fromTime,
            endTime: untilTime,
            durationMins: Number(durationMins),
            quota: Number(seats),
          }),
        });
        await readJsonOrThrow(slots, "The day was created, but the times were not. Add them on the event page.");
      }
      router.push(`/bookings/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-4">
      <div>
        <label className="label">{t("Event name *")}</label>
        <input
          type="text"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("e.g. Massage, DIY Workshop")}
          required
        />
      </div>

      <div>
        <label className="label">{t("Company *")}</label>
        <input
          type="text"
          className="input"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder={t("Which company this event is being run for")}
          required
        />
      </div>

      <div>
        <label className="label">{t("Description (optional)")}</label>
        <textarea
          className="input min-h-[80px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("Shown to clients on this event's booking page")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">{t("Day *")}</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
            }}
            required
          />
        </div>
        <div>
          <label className="label">{t("Last day")}</label>
          <input
            type="date"
            className="input"
            value={endDate || startDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">{t("From")}</label>
          <input type="time" className="input" value={fromTime} onChange={(e) => setFromTime(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t("Until")}</label>
          <input type="time" className="input" value={untilTime} onChange={(e) => setUntilTime(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t("Each visit, in minutes")}</label>
          <input type="number" min={1} max={480} className="input" value={durationMins} onChange={(e) => setDurationMins(e.target.value)} required />
        </div>
        <div>
          <label className="label">{t("Seats at each time")}</label>
          <input type="number" min={1} max={500} className="input" value={seats} onChange={(e) => setSeats(e.target.value)} required />
        </div>
      </div>
      <p className="text-xs text-ink-faint -mt-2">
        {t("Use the same day twice for one day. Times are filled from the start until the end. A time with no seats left shows as full and cannot be booked.")}
      </p>

      <label className="flex items-start gap-2.5 rounded-xl border border-line p-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={requiresConfirmation}
          onChange={(e) => setRequiresConfirmation(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-ink">{t("Require staff confirmation")}</span>
          <span className="block text-xs text-ink-muted mt-0.5">
            {t(
              "New bookings will wait for a staff member to confirm them here before the client's confirmation email is sent. Leave unchecked to accept every booking automatically."
            )}
          </span>
        </span>
      </label>

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}

      <button type="submit" disabled={submitting} className="btn-primary self-start">
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {submitting ? t("Creating…") : t("Create event")}
      </button>
    </form>
  );
}
