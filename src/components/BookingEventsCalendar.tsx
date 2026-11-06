"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, ExternalLink } from "lucide-react";
import clsx from "clsx";
import Portal from "@/components/Portal";
import { formatDateLabel } from "@/lib/bookingFormat";
import { useT } from "@/lib/i18n/client";

// A read-only month calendar of every booking event, laid out as multi-day
// bars — so staff can see at a glance which events are running (or upcoming)
// on any given day, alongside the plain table list on the same page. Adapted
// from AttendanceCalendar.tsx's month-grid/lane-stacking approach for
// multi-day leave spans; here each bar is a BookingEvent's own
// [startDate, endDate] range rather than one employee's leave.
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

const MAX_LANES = 3;
const BAR_HEIGHT = 22;
const BAR_GAP = 4;
const HEADER_HEIGHT = 30;
const MORE_ROW_HEIGHT = 18;

// A restrained palette, chosen from the event id so overlapping events stay
// distinct. Not stored, and not user-editable.
const EVENT_COLORS = ["#3B6FE0", "#0E9F8E", "#7A5AF0", "#1F9D55", "#E07A2F", "#E15B73"];
const JOB_COLOR = "#8B93A7";

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
function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
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

// Classic greedy interval-scheduling "lane" assignment so a multi-day event
// bar keeps the same row as it stretches across the grid, the way Google
// Calendar's month view stacks overlapping events.
function assignLanes(events: NormEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => {
    const byStart = a.start.getTime() - b.start.getTime();
    if (byStart !== 0) return byStart;
    return b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());
  });
  const laneEnds: number[] = [];
  const laneOf = new Map<string, number>();
  for (const ev of sorted) {
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < ev.start.getTime()) {
        laneEnds[i] = ev.end.getTime();
        laneOf.set(ev.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneEnds.push(ev.end.getTime());
      laneOf.set(ev.id, laneEnds.length - 1);
    }
  }
  return laneOf;
}

type Segment = {
  ev: NormEvent;
  startCol: number;
  span: number;
  lane: number;
  continuesLeft: boolean;
  continuesRight: boolean;
};

function WeekRow({
  week,
  events,
  laneOf,
  today,
  monthDate,
  onEventClick,
  onMoreClick,
}: {
  week: Date[];
  events: NormEvent[];
  laneOf: Map<string, number>;
  today: Date;
  monthDate: Date;
  onEventClick: (ev: NormEvent) => void;
  onMoreClick: (day: Date, events: NormEvent[]) => void;
}) {
  const t = useT();
  const weekStart = week[0];
  const weekEnd = week[6];

  const segments: Segment[] = events
    .filter((ev) => ev.end >= weekStart && ev.start <= weekEnd)
    .map((ev) => {
      const segStart = ev.start < weekStart ? weekStart : ev.start;
      const segEnd = ev.end > weekEnd ? weekEnd : ev.end;
      return {
        ev,
        startCol: daysBetween(weekStart, segStart),
        span: daysBetween(segStart, segEnd) + 1,
        lane: laneOf.get(ev.id) ?? 0,
        continuesLeft: ev.start < weekStart,
        continuesRight: ev.end > weekEnd,
      };
    });

  const visible = segments.filter((s) => s.lane < MAX_LANES);
  const hidden = segments.filter((s) => s.lane >= MAX_LANES);
  const hiddenByDay = week.map((_, i) => hidden.filter((s) => i >= s.startCol && i < s.startCol + s.span));

  const maxLaneUsed = visible.reduce((m, s) => Math.max(m, s.lane), -1);
  const hasMoreRow = hiddenByDay.some((h) => h.length > 0);
  const rowHeight =
    HEADER_HEIGHT + (maxLaneUsed + 1) * (BAR_HEIGHT + BAR_GAP) + (hasMoreRow ? MORE_ROW_HEIGHT : 6);

  return (
    <div className="grid grid-cols-7 divide-x divide-slate-200 border-t border-slate-200 bg-white text-xs" style={{ minHeight: Math.max(rowHeight, 90) }}>
      {week.map((d, i) => {
        const inMonth = d.getMonth() === monthDate.getMonth();
        const today_ = isSameDay(d, today);
        const onDay = segments
          .filter((s) => i >= s.startCol && i < s.startCol + s.span)
          .sort((a, b) => a.lane - b.lane);
        const shown = onDay.filter((s) => s.lane < MAX_LANES);
        const extra = hiddenByDay[i];
        return (
          <div key={i} className={clsx("flex min-h-[90px] flex-col p-2", !inMonth && "bg-slate-50")}>
            <span
              className={clsx(
                "mb-1 inline-flex font-semibold",
                today_
                  ? "h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white"
                  : inMonth
                    ? "text-slate-800"
                    : "text-slate-400"
              )}
            >
              {d.getDate()}
            </span>
            <div className="mt-1 space-y-1">
              {shown.map((s) => {
                const job = s.ev.kind === "job";
                return (
                  <button
                    key={`${s.ev.id}-${i}`}
                    type="button"
                    onClick={() => onEventClick(s.ev)}
                    title={s.ev.name}
                    className={clsx(
                      "flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium",
                      job ? "border-amber-200 bg-amber-50/30 text-amber-950" : "border-indigo-200 bg-indigo-50/30 text-indigo-950",
                      !job && !s.ev.active && "border-dashed"
                    )}
                  >
                    <span className={clsx("h-3 w-0.5 shrink-0 rounded-full", job ? "bg-amber-700" : "bg-indigo-600")} />
                    <span className="truncate">{s.ev.name}</span>
                  </button>
                );
              })}
              {extra.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onMoreClick(d, [...shown.map((s) => s.ev), ...extra.map((s) => s.ev)])}
                  className="px-1 text-left text-[11px] font-medium text-slate-500 hover:text-slate-800"
                >
                  {t("+{count} more", { count: extra.length })}
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
  const laneOf = useMemo(() => assignLanes(visibleEvents), [visibleEvents]);

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
    <div className="w-full space-y-6 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-1.5 text-left"
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
            <h2 className="text-lg font-bold text-slate-900">{monthLabel}</h2>
          </button>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" aria-hidden="true" />
              {t("Booking")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-700" aria-hidden="true" />
              {t("Invoice job")}
            </span>
          </div>
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={goToday} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              {t("Today")}
            </button>
            <div className="flex items-center overflow-hidden rounded-md border border-slate-200">
              <button type="button" onClick={goPrevMonth} aria-label={t("Previous month")} className="border-r border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronLeft size={16} />
              </button>
              <button type="button" onClick={goNextMonth} aria-label={t("Next month")} className="p-1.5 text-slate-600 hover:bg-slate-50">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {!collapsed && (
          <div key={monthLabel}>
          <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50 py-2.5 text-center text-xs font-semibold text-slate-600">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label}>{t(label)}</div>
            ))}
          </div>
            {weeks.map((week, i) => (
              <WeekRow
                key={i}
                week={week}
                events={visibleEvents}
                laneOf={laneOf}
                today={today}
                monthDate={monthDate}
                onEventClick={(ev) => setModal({ mode: "event", event: ev })}
                onMoreClick={(date, dayEvents) => setModal({ mode: "day", date, events: dayEvents })}
              />
            ))}
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
