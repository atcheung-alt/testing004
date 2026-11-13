"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, AlertCircle, CheckCircle2, CalendarDays, Check } from "lucide-react";
import clsx from "clsx";
import PublicBookingShell from "@/components/PublicBookingShell";
import type { PublicCompany } from "@/components/PublicCompanyHeader";
import PublicEventCalendar from "@/components/PublicEventCalendar";
import { formatDateLabel, formatTimeRangeLabel, formatSlotLabel, readJsonOrThrow } from "@/lib/bookingFormat";
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

type DescriptionBlock =
  | { type: "p"; text: string }
  | { type: "label"; text: string }
  | { type: "fact"; label: string; text: string };

function tidyOrdinals(text: string) {
  return text.replace(/\b(\d+)th\b/gi, (_all, raw) => {
    const num = Number(raw);
    const mod = num % 100;
    if (mod >= 11 && mod <= 13) return `${num}th`;
    const end = num % 10;
    const suffix = end === 1 ? "st" : end === 2 ? "nd" : end === 3 ? "rd" : "th";
    return `${num}${suffix}`;
  });
}

function descriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const fact = line.match(/^(?:[·•*\-]\s*)?(date|time|remarks|session)\s*[:：]\s*(.+)$/i);
    if (fact) {
      blocks.push({ type: "fact", label: fact[1], text: tidyOrdinals(fact[2].trim()) });
      continue;
    }
    if (/^(event details|registration method)\s*:?\s*$/i.test(line)) {
      blocks.push({ type: "label", text: line.replace(/:\s*$/, "") });
      continue;
    }
    blocks.push({ type: "p", text: tidyOrdinals(line) });
  }
  return blocks;
}

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
  const [savedChoice, setSavedChoice] = useState<{ status: string; slotLabel: string } | null>(null);
  const [confirmed, setConfirmed] = useState<{
    date: string;
    startTime: string;
    durationMins: number;
    status: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const key = `hrplus-booking:${event.id}`;
    let stop = false;
    async function load() {
      const id = window.localStorage.getItem(key);
      if (!id) return;
      const res = await fetch(`/api/public/bookings/status?id=${encodeURIComponent(id)}&eventId=${encodeURIComponent(event.id)}`);
      const data = await res.json().catch(() => ({}));
      if (!stop) setSavedChoice(data.booking || null);
    }
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [event.id]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId) || null;
  const [screen, setScreen] = useState<"date" | "time" | "details">(date ? "time" : "date");
  const step = screen === "date" ? 1 : screen === "time" ? 2 : 3;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

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
      window.localStorage.setItem(`hrplus-booking:${event.id}`, data.id);
      setSavedChoice({
        status: data.status,
        slotLabel: formatSlotLabel(data.date, data.startTime, data.durationMins),
      });
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
      <PublicBookingShell company={company} dark>
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
          </div>
        </div>
      </PublicBookingShell>
    );
  }

  const story = descriptionBlocks(event.description || "");
  const hasFacts = story.some((block) => block.type === "fact");

  return (
    <PublicBookingShell company={company} dark>
      <div className="mx-auto my-6 grid w-[min(960px,calc(100%-2rem))] overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(15,23,42,0.7)] shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:grid-cols-[38%_1fr]">
        <aside className="border-b border-white/10 px-5 py-6 lg:border-b-0 lg:border-r">
          {/trail\s*link|trial\s*link/i.test(event.name) && (
            <span className="mb-3 inline-flex rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] tracking-[0.14em] text-amber-200">
              TRIAL LINK
            </span>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {event.name.replace(/\(([^)]*trail\s*link[^)]*)\)/i, "").replace(/trail\s*link\s*for\s*client\s*reference/i, "").trim() || event.name}
          </h1>
          {event.companyName && (
            <p className="text-sm text-ink-muted mt-1">{t("For {company}", { company: event.companyName })}</p>
          )}
          <div className="mt-6 text-sm text-ink-muted leading-relaxed">
            {!hasFacts && (
              <div className="border-t border-line py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide">{t("Date")}</p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {formatDateLabel(new Date(event.startDate))}
                  {calendarDay(event.startDate) !== calendarDay(event.endDate)
                    ? ` – ${formatDateLabel(new Date(event.endDate))}`
                    : ""}
                </p>
              </div>
            )}
            {story.map((block, index) =>
              block.type === "fact" ? (
                <div key={index} className="border-t border-line py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">{t(block.label[0].toUpperCase() + block.label.slice(1).toLowerCase())}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{block.text}</p>
                </div>
              ) : block.type === "label" ? (
                <p key={index} className="mt-4 text-[11px] font-semibold uppercase tracking-wide">{block.text}</p>
              ) : (
                <p key={index} className="mt-3">{block.text}</p>
              )
            )}
          </div>
          {savedChoice && (
            <p className="mt-3 text-sm text-ink rounded-md border border-line bg-surface px-3 py-2">
              {t("Your choice")}: {savedChoice.slotLabel} · {t(savedChoice.status)}
            </p>
          )}
          {event.requiresConfirmation && (
            <p className="mt-3 text-sm text-ink-muted rounded-md border border-line bg-surface px-3 py-2 inline-block">
              {t("A staff member confirms each request before it is final.")}
            </p>
          )}
        </aside>
        <div className="px-6 py-8">

        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {(
            [
              [1, "Date", "date"],
              [2, "Time", "time"],
              [3, "Your Details", "details"],
            ] as const
          ).map(([n, label, name], index) => {
            const open = name === "date" || (name === "time" && !!date) || (name === "details" && !!date && !!selectedSlot);
            return (
              <li key={n} className="flex items-center gap-2 min-w-0">
                {index > 0 && <span className="hidden sm:block w-6 h-px bg-line" />}
                <button
                  type="button"
                  disabled={!open}
                  onClick={() => open && setScreen(name)}
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
                </button>
              </li>
            );
          })}
        </ol>

        <form onSubmit={submit} className="flex flex-col gap-5">
          {screen === "date" && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">{t("Pick a Date")}</h2>
              <p className="text-sm text-ink-muted mt-1 mb-4">{t("Choose a day. Coloured days still have space.")}</p>
              <PublicEventCalendar
                eventId={event.id}
                minDate={new Date(event.startDate)}
                maxDate={new Date(event.endDate)}
                selectedDate={date}
                onSelectDate={(next) => {
                  setDate(next);
                  setScreen("time");
                }}
              />
            </div>
          )}

          {screen === "time" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-1.5">
                    <Clock size={18} /> {t("Choose a time.")}
                  </h2>
                  {date && <p className="text-sm text-ink-muted mt-1">{formatDateLabel(date)}</p>}
                </div>
                <button type="button" onClick={() => setScreen("date")} className="btn-secondary shrink-0">
                  {t("Change day")}
                </button>
              </div>
              {loadingSlots ? (
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
                <>
                <p className="text-sm text-ink-muted pb-2">
                  {t("Choose a time. The next step asks for your name, email, and phone. A full time cannot be selected.")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {slots.map((slot) => {
                    const full = slot.available <= 0;
                    const isSelected = slot.id === selectedSlotId;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={full}
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setScreen("details");
                        }}
                        className={clsx(
                          "flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                          isSelected
                            ? "border-indigo-500 bg-indigo-600/20 text-white shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                            : full
                              ? "border-white/10 text-slate-500 cursor-not-allowed bg-slate-950/40"
                              : "border-white/10 bg-slate-900/60 text-white hover:border-indigo-400/50"
                        )}
                      >
                        <span className="font-medium tabular-nums">{formatTimeRangeLabel(slot.startTime, slot.durationMins)}{isSelected ? " ✓" : ""}</span>
                        <span className={clsx("text-xs shrink-0", isSelected ? "text-white/80" : "text-ink-faint")}>
                          {full
                            ? t("Full")
                            : t(slot.available === 1 ? "{count} spot left" : "{count} spots left", { count: slot.available })}
                        </span>
                      </button>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}

          {screen === "details" && date && selectedSlot && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-ink">{t("Your Details")}</h2>
                  <p className="text-sm text-ink-muted mt-1">{t("Check this time, then leave your name and email.")}</p>
                </div>
                <button type="button" onClick={() => setScreen("time")} className="btn-secondary shrink-0">
                  {t("Change time")}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-ink">
                <CalendarDays size={15} className="text-brand-600 shrink-0" />
                {formatSlotLabel(date, selectedSlot.startTime, selectedSlot.durationMins)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">{t("Your name *")}</label>
                  <input
                    type="text"
                    className="h-11 w-full rounded-[10px] border border-white/10 bg-slate-950/60 px-3 focus:border-indigo-500 focus:outline-none"
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
                    className="h-11 w-full rounded-[10px] border border-white/10 bg-slate-950/60 px-3 focus:border-indigo-500 focus:outline-none"
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
                  className="h-11 w-full rounded-[10px] border border-white/10 bg-slate-950/60 px-3 focus:border-indigo-500 focus:outline-none"
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
                  className="min-h-[80px] w-full rounded-[10px] border border-white/10 bg-slate-950/60 px-3 py-2 focus:border-indigo-500 focus:outline-none"
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

              <button type="submit" disabled={submitting} className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:brightness-110 disabled:opacity-60">
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {submitting ? t("Submitting…") : event.requiresConfirmation ? t("Request booking") : t("Confirm booking")}
              </button>
            </div>
          )}
        </form>
        </div>
      </div>
    </PublicBookingShell>
  );
}
