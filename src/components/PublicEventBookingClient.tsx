"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Loader2, AlertCircle, CheckCircle2, CalendarDays, ChevronLeft, Check } from "lucide-react";
import clsx from "clsx";
import PublicBookingShell from "@/components/PublicBookingShell";
import type { PublicCompany } from "@/components/PublicCompanyHeader";
import PublicEventCalendar from "@/components/PublicEventCalendar";
import { formatTimeRangeLabel, formatSlotLabel, readJsonOrThrow } from "@/lib/bookingFormat";
import { useT } from "@/lib/i18n/client";

type EventInfo = {
  id: string;
  name: string;
  companyName: string;
  description: string;
  startDate: string; // ISO
  endDate: string; // ISO
  requiresConfirmation: boolean;
};

type SlotOption = { id: string; startTime: string; durationMins: number; quota: number; available: number };

function calendarDay(iso: string): string {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A one-day event opens straight on that day when it is still bookable. */
function initialDate(event: EventInfo): string | null {
  const start = calendarDay(event.startDate);
  if (start !== calendarDay(event.endDate)) return null;
  const day = new Date(event.startDate);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return day < today ? null : start;
}

export default function PublicEventBookingClient({ event, company }: { event: EventInfo; company: PublicCompany }) {
  const t = useT();
  const [date, setDate] = useState<string | null>(initialDate(event));
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    startTime: string;
    durationMins: number;
    status: string;
    email: string;
  } | null>(null);
  const timesRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) || null;
  const step = !date ? 1 : !selectedSlot ? 2 : 3;

  async function refreshSlots(forDate: string) {
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const res = await fetch(`/api/public/bookings/events/${event.id}/slots?date=${encodeURIComponent(forDate)}`);
      const data = await readJsonOrThrow(res, "Could not load available times.");
      setSlots(data.slots || []);
    } catch (err: any) {
      setSlots([]);
      setSlotsError(err.message);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    setSelectedSlotId(null);
    if (!date) {
      setSlots([]);
      return;
    }
    refreshSlots(date);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      timesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    if (!selectedSlotId) return;
    detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedSlotId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!date || !selectedSlotId) {
      setSubmitError("Please pick a date and time first.");
      return;
    }
    if (!clientName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!clientEmail.trim()) {
      setSubmitError("Please provide an email address so we can confirm your booking.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlotId,
          clientName,
          clientPhone,
          clientEmail,
          notes,
        }),
      });
      const data = await readJsonOrThrow(res, "Something went wrong. Please try again.");
      setConfirmed({
        date: data.date,
        startTime: data.startTime,
        durationMins: data.durationMins,
        status: data.status,
        email: clientEmail.trim(),
      });
      setClientName("");
      setClientPhone("");
      setClientEmail("");
      setNotes("");
      setSelectedSlotId(null);
      await refreshSlots(date);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    const isPending = confirmed.status === "PENDING";
    return (
      <PublicBookingShell company={company}>
        <div className="max-w-lg mx-auto card p-8 flex flex-col items-center text-center gap-3">
          <CheckCircle2 size={40} className={isPending ? "text-amber-500" : "text-emerald-500"} />
          <h1 className="font-display text-2xl font-semibold text-ink">
            {isPending ? t("Booking request received") : t("Booking confirmed")}
          </h1>
          <p className="text-sm text-ink">
            {event.name}
            {event.companyName ? ` · ${event.companyName}` : ""}
          </p>
          <p className="text-sm text-ink-muted">
            {formatSlotLabel(confirmed.date, confirmed.startTime, confirmed.durationMins)}
          </p>
          <p className="text-sm text-ink-muted">
            {isPending
              ? t(
                  "This isn't confirmed yet — we'll follow up shortly. We've emailed you the details, along with a link to withdraw your request if needed."
                )
              : t(
                  "We've sent a confirmation email with your booking details and a link to cancel if your plans change."
                )}
          </p>
          {confirmed.email && (
            <p className="text-sm text-ink-muted">{t("Sent to {email}.", { email: confirmed.email })}</p>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button type="button" onClick={() => setConfirmed(null)} className="btn-primary">
              {t("Make another booking")}
            </button>
            <Link href="/book" className="btn-secondary">
              {t("All appointments")}
            </Link>
          </div>
        </div>
      </PublicBookingShell>
    );
  }

  return (
    <PublicBookingShell company={company}>
      <div className="flex flex-col gap-6">
        <div>
          <Link href="/book" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-3">
            <ChevronLeft size={15} /> {t("All appointments")}
          </Link>
          <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{event.name}</h1>
          {event.companyName && (
            <p className="text-sm text-ink mt-1">{t("For {company}", { company: event.companyName })}</p>
          )}
          {event.description && (
            <p className="text-sm text-ink-muted mt-2 max-w-2xl whitespace-pre-wrap">{event.description}</p>
          )}
          {event.requiresConfirmation && (
            <p className="mt-3 text-sm text-ink-muted rounded-md border border-line bg-surface px-3 py-2 inline-block">
              {t("A staff member confirms each request before it is final.")}
            </p>
          )}
        </div>

        <ol className="flex items-center gap-2 text-sm">
          {(
            [
              [1, "Date"],
              [2, "Time"],
              [3, "Your details"],
            ] as const
          ).map(([n, label], index) => (
            <li key={n} className="flex items-center gap-2 min-w-0">
              {index > 0 && <span className="hidden sm:block w-6 h-px bg-line" />}
              <span
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1",
                  step === n
                    ? "border-brand-600 bg-brand-50 text-ink font-medium"
                    : step > n
                      ? "border-line bg-surface text-ink"
                      : "border-line text-ink-faint"
                )}
              >
                <span
                  className={clsx(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    step === n ? "bg-brand-600 text-white" : step > n ? "bg-brand-100 text-brand-700" : "bg-paper text-ink-faint"
                  )}
                >
                  {step > n ? <Check size={12} /> : n}
                </span>
                {t(label)}
              </span>
            </li>
          ))}
        </ol>

        <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="label mb-2">{t("Pick a date")}</label>
              <PublicEventCalendar
                eventId={event.id}
                minDate={new Date(event.startDate)}
                maxDate={new Date(event.endDate)}
                selectedDate={date}
                onSelectDate={setDate}
              />
            </div>

            <div ref={timesRef} className="flex flex-col gap-3 lg:border-l lg:border-line lg:pl-6 scroll-mt-4">
              <label className="label flex items-center gap-1.5">
                <Clock size={13} /> {t("Available times")}
              </label>
              {!date ? (
                <p className="text-sm text-ink-muted">{t("Select a date on the calendar to see available times.")}</p>
              ) : loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-ink-muted py-3">
                  <Loader2 size={15} className="animate-spin" /> {t("Loading times…")}
                </div>
              ) : slotsError ? (
                <p className="text-sm text-danger-600 py-2">{t(slotsError)}</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-ink-muted py-2">
                  {t("No times available that day — please pick another date on the calendar.")}
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const isSelected = slot.id === selectedSlotId;
                    const full = slot.available <= 0;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={full}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={clsx(
                          "flex items-center justify-between gap-3 rounded-md border px-3 py-3 text-left text-sm transition-colors",
                          isSelected
                            ? "border-brand-600 bg-brand-600 text-white"
                            : full
                              ? "border-line text-ink-faint cursor-not-allowed bg-paper"
                              : "border-line bg-surface hover:border-brand-300 hover:bg-brand-50 text-ink"
                        )}
                      >
                        <span className="font-medium">{formatTimeRangeLabel(slot.startTime, slot.durationMins)}</span>
                        <span className={clsx("text-xs shrink-0", isSelected ? "text-white/80" : "text-ink-faint")}>
                          {full
                            ? t("Full")
                            : t(slot.available === 1 ? "{count} spot left" : "{count} spots left", { count: slot.available })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {date && selectedSlot && (
            <div ref={detailsRef} className="flex flex-col gap-4 border-t border-line pt-5 scroll-mt-4">
              <div className="flex items-center gap-2 text-sm text-ink">
                <CalendarDays size={15} className="text-brand-600" />
                {formatSlotLabel(date, selectedSlot.startTime, selectedSlot.durationMins)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t("Your name *")}</label>
                  <input
                    type="text"
                    className="input"
                    autoComplete="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">{t("Phone (optional)")}</label>
                  <input
                    type="tel"
                    className="input"
                    autoComplete="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">{t("Email *")}</label>
                <input
                  type="email"
                  className="input"
                  autoComplete="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-ink-faint">{t("We'll email you a confirmation with your booking details.")}</p>
              </div>

              <div>
                <label className="label">{t("Notes (optional)")}</label>
                <textarea
                  className="input min-h-[70px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("Anything else we should know")}
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-md px-3 py-2">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{t(submitError)}</span>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary self-start">
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {submitting ? t("Submitting…") : event.requiresConfirmation ? t("Request booking") : t("Confirm booking")}
              </button>
            </div>
          )}
        </form>
      </div>
    </PublicBookingShell>
  );
}
