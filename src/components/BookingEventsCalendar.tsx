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
const EVENT_COLORS = ["#5B8DEF", "#3DAB9A", "#8B7EC8", "#5C9A6A", "#C4893A", "#C46B73"];

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
    <div className="relative grid grid-cols-7 border-t border-ink-faint/25" style={{ minHeight: Math.max(rowHeight, 100) }}>
      {week.map((d, i) => {
        const inMonth = d.getMonth() === monthDate.getMonth();
        const today_ = isSameDay(d, today);
        return (
          <div
            key={i}
            className={clsx(
              "border-r border-ink-faint/25 last:border-r-0 px-1.5 pt-1.5",
              !inMonth && "bg-paper",
              today_ && inMonth && "bg-brand-50/50"
            )}
          >
            <span
              className={clsx(
                "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                today_ ? "bg-brand-500 font-semibold text-white" : inMonth ? "font-medium text-ink" : "text-ink-faint"
              )}
            >
              {d.getDate()}
            </span>
          </div>
        );
      })}

      {visible.map((s) => {
        const color = colorFor(s.ev);
        return (
          <button
            key={`${s.ev.id}-${s.startCol}`}
            type="button"
            onClick={() => onEventClick(s.ev)}
            title={s.ev.name}
            className="absolute overflow-hidden text-left text-[11px] font-medium leading-[22px] truncate px-2 hover:brightness-110"
            style={{
              top: HEADER_HEIGHT + s.lane * (BAR_HEIGHT + BAR_GAP),
              left: `calc(${(s.startCol / 7) * 100}% + 3px)`,
              width: `calc(${(s.span / 7) * 100}% - 6px)`,
              height: BAR_HEIGHT,
              borderTopLeftRadius: s.continuesLeft ? 2 : 6,
              borderBottomLeftRadius: s.continuesLeft ? 2 : 6,
              borderTopRightRadius: s.continuesRight ? 2 : 6,
              borderBottomRightRadius: s.continuesRight ? 2 : 6,
              backgroundColor: s.ev.kind === "job" || s.ev.active ? color : "transparent",
              color: s.ev.kind === "job" || s.ev.active ? "#fff" : color,
              boxShadow: s.ev.kind === "job" || s.ev.active ? undefined : `inset 0 0 0 1px ${color}`,
            }}
          >
            {s.ev.name}
          </button>
        );
      })}

      {week.map((d, i) =>
        hiddenByDay[i].length > 0 ? (
          <button
            key={`more-${i}`}
            type="button"
            onClick={() =>
              onMoreClick(d, [
                ...visible.filter((s) => i >= s.startCol && i < s.startCol + s.span).map((s) => s.ev),
                ...hiddenByDay[i].map((s) => s.ev),
              ])
            }
            className="absolute px-1.5 text-[11px] font-medium text-ink-muted hover:text-ink"
            style={{
              top: HEADER_HEIGHT + MAX_LANES * (BAR_HEIGHT + BAR_GAP),
              left: `${(i / 7) * 100}%`,
            }}
          >
            {t("+{count} more", { count: hiddenByDay[i].length })}
          </button>
        ) : null
      )}
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
    <div className="card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex flex-wrap items-center justify-between gap-3 w-full text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center gap-1.5">
          {collapsed ? <ChevronDown size={16} className="text-ink-faint" /> : <ChevronUp size={16} className="text-ink-faint" />}
          <h2 className="font-sans text-lg font-semibold text-ink">{monthLabel}</h2>
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
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EVENT_COLORS[0] }} aria-hidden="true" />
              {t("Booking")}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: JOB_COLOR }} aria-hidden="true" />
              {t("Invoice job")}
            </span>
          </div>
          <div className="mb-1 grid grid-cols-7 border-b border-line pb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-medium text-ink-muted">
                {t(label)}
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-ink-faint/25">
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
