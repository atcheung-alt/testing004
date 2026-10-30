"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, ExternalLink } from "lucide-react";
import clsx from "clsx";
import Portal from "@/components/Portal";
import { formatDateLabel } from "@/lib/bookingFormat";
import { useT } from "@/lib/i18n/client";

// A read-only month calendar of every booking event. Each day lists the
// names in dark type, with a color mark for a booking or an invoice job.
// A busy day keeps two names and opens the rest. Alongside the event list
// on the same page.
export type BookingEventCalendarItem = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
  /** Booking events are coloured. Jobs marked from an invoice use one grey bar. */
  kind?: "booking" | "job";
  href?: string;
};

type NormEvent = BookingEventCalendarItem & { start: Date; end: Date };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const VISIBLE_PER_DAY = 2;

// A mark on the left of each name, chosen from the event id so overlapping
// events stay distinct. The name itself stays dark. Not stored, and not user-editable.
const EVENT_COLORS = ["#2457c5", "#0b7a6e", "#5b3fd4", "#157a40", "#b45309", "#be3454"];
const JOB_COLOR = "#3e4a63";

export function eventBarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return EVENT_COLORS[hash % EVENT_COLORS.length];
}

function colorFor(event: { id: string; kind?: "booking" | "job" }) {
  if (event.kind === "job") return JOB_COLOR;
  return eventBarColor(event.id);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function normalizeEvents(events: BookingEventCalendarItem[]): NormEvent[] {
  return events.map((e) => {
    const start = startOfDay(new Date(e.startDate));
    let end = startOfDay(new Date(e.endDate));
    if (end < start) end = start;
    return { ...e, start, end };
  });
}

function getMonthGrid(monthDate: Date): Date[][] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());

  const days: Date[] = [];
  for (let cur = gridStart; cur <= gridEnd; cur = addDays(cur, 1)) {
    days.push(cur);
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function eventsOnDay(events: NormEvent[], day: Date): NormEvent[] {
  return events
    .filter((ev) => ev.start <= day && ev.end >= day)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.name.localeCompare(b.name));
}

function WeekRow({
  week,
  events,
  today,
  monthDate,
  onEventClick,
  onMoreClick,
}: {
  week: Date[];
  events: NormEvent[];
  today: Date;
  monthDate: Date;
  onEventClick: (ev: NormEvent) => void;
  onMoreClick: (day: Date, events: NormEvent[]) => void;
}) {
  const t = useT();

  return (
    <div className="grid grid-cols-7 border-t border-line">
      {week.map((d, i) => {
        const inMonth = d.getMonth() === monthDate.getMonth();
        const today_ = isSameDay(d, today);
        const here = eventsOnDay(events, d);
        const shown = here.slice(0, VISIBLE_PER_DAY);
        const extra = here.length - shown.length;
        const dayNumber = (
          <span
            className={clsx(
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
              today_ ? "bg-brand-500 text-white" : inMonth ? "text-ink" : "text-ink-muted"
            )}
          >
            {d.getDate()}
          </span>
        );
        return (
          <div
            key={i}
            className={clsx(
              "min-h-[118px] border-r border-line px-1.5 py-1.5 last:border-r-0",
              !inMonth && "bg-paper",
              today_ && inMonth && "bg-brand-50/50"
            )}
          >
            {here.length > 0 ? (
              <button type="button" className="rounded-full" onClick={() => onMoreClick(d, here)} aria-label={formatDateLabel(d)}>
                {dayNumber}
              </button>
            ) : (
              dayNumber
            )}
            <div className="mt-1 flex flex-col gap-1">
              {shown.map((ev) => {
                const inactive = ev.kind !== "job" && !ev.active;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onEventClick(ev)}
                    title={ev.name}
                    className={clsx(
                      "block w-full truncate rounded-md border border-[#d5dbe6] bg-white px-1.5 py-1 text-left font-sans text-[13px] font-semibold leading-tight text-ink",
                      inactive && "border-dashed"
                    )}
                    style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: colorFor(ev) }}
                  >
                    {ev.name}
                  </button>
                );
              })}
              {extra > 0 ? (
                <button
                  type="button"
                  onClick={() => onMoreClick(d, here)}
                  className="px-0.5 text-left text-[13px] font-semibold text-ink hover:text-brand-600"
                >
                  {t("+{count} more", { count: extra })}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookingEventDetail({ ev }: { ev: NormEvent }) {
  const t = useT();
  const spansDays = !isSameDay(ev.start, ev.end);
  const color = colorFor(ev);
  const isJob = ev.kind === "job";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
        <div className="min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium text-ink truncate">{ev.name}</p>
          {isJob ? (
            <span className="text-[11px] font-medium text-ink-faint">{t("Invoice job")}</span>
          ) : (
            <span className={ev.active ? "text-[11px] font-medium text-brand-600" : "text-[11px] font-medium text-ink-faint"}>
              {ev.active ? t("Active") : t("Inactive")}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line p-3 text-sm">
        <p className="text-ink">{formatDateLabel(ev.start)}</p>
        {spansDays && <p className="text-ink-muted mt-0.5">{t("to {date}", { date: formatDateLabel(ev.end) })}</p>}
      </div>

      {ev.description && (
        <div>
          <p className="label mb-1">{t("Description")}</p>
          <p className="text-sm text-ink-muted whitespace-pre-wrap">{ev.description}</p>
        </div>
      )}

      <Link href={ev.href || `/bookings/${ev.id}`} className="btn-secondary self-start">
        <ExternalLink size={15} /> {isJob ? t("Open invoice") : t("Open event")}
      </Link>
    </div>
  );
}

type ModalState =
  | { mode: "event"; event: NormEvent }
  | { mode: "day"; date: Date; events: NormEvent[] }
  | null;

export default function BookingEventsCalendar({ events }: { events: BookingEventCalendarItem[] }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthDate, setMonthDate] = useState(() => startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [modal, setModal] = useState<ModalState>(null);
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();

  const normalized = useMemo(() => normalizeEvents(events), [events]);

  const weeks = useMemo(() => getMonthGrid(monthDate), [monthDate]);
  const gridStart = weeks[0][0];
  const gridEnd = weeks[weeks.length - 1][6];

  const visibleEvents = useMemo(
    () => normalized.filter((ev) => ev.end >= gridStart && ev.start <= gridEnd),
    [normalized, gridStart, gridEnd]
  );

  function goPrevMonth() {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function goNextMonth() {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  const monthLabel = t("{month} {year}", {
    month: t(MONTH_NAMES[monthDate.getMonth()]),
    year: monthDate.getFullYear(),
  });

  return (
    <div className="card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex flex-wrap items-center justify-between gap-3 w-full text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1.5">
          {collapsed ? <ChevronDown size={16} className="text-ink-faint" /> : <ChevronUp size={16} className="text-ink-faint" />}
          <h2 className="font-sans text-xl font-bold tracking-tight text-ink">{monthLabel}</h2>
        </span>
        {!collapsed && (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={goToday} className="btn-secondary">
              {t("Today")}
            </button>
            <button type="button" onClick={goPrevMonth} aria-label={t("Previous month")} className="btn-secondary px-2.5">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={goNextMonth} aria-label={t("Next month")} className="btn-secondary px-2.5">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </button>

      {!collapsed && (
          <div className="mt-4 animate-fade-in" key={monthLabel}>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-ink">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EVENT_COLORS[0] }} aria-hidden="true" />
              {t("Booking")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: JOB_COLOR }} aria-hidden="true" />
              {t("Invoice job")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="mb-1 grid min-w-[756px] grid-cols-7 border-b border-line pb-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-center text-[13px] font-semibold text-ink">
                  {t(label)}
                </div>
              ))}
            </div>

            <div className="min-w-[756px] overflow-hidden rounded-lg border border-line">
              {weeks.map((week, i) => (
                <WeekRow
                  key={i}
                  week={week}
                  events={visibleEvents}
                  today={today}
                  monthDate={monthDate}
                  onEventClick={(ev) => setModal({ mode: "event", event: ev })}
                  onMoreClick={(date, dayEvents) => setModal({ mode: "day", date, events: dayEvents })}
                />
              ))}
            </div>
          </div>

          {normalized.length === 0 && (
            <p className="text-sm text-ink-muted mt-4">
              {t("Nothing scheduled this month.")}
            </p>
          )}
        </div>
      )}

      {modal && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 animate-fade-in"
            onClick={() => setModal(null)}
          >
            <div className="card p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {modal.mode === "event"
                    ? modal.event.kind === "job"
                      ? t("Invoice job")
                      : t("Booking")
                    : formatDateLabel(modal.date)}
                </h2>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="text-ink-faint hover:text-ink transition-colors"
                  aria-label={t("Close")}
                >
                  <X size={18} />
                </button>
              </div>

              {modal.mode === "event" ? (
                <BookingEventDetail ev={modal.event} />
              ) : (
                <div className="flex flex-col divide-y divide-line">
                  {modal.events.map((ev) => {
                    const color = colorFor(ev);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setModal({ mode: "event", event: ev })}
                        className="flex items-center gap-3 py-2.5 text-left hover:bg-paper -mx-1 px-1 rounded-lg transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{ev.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
