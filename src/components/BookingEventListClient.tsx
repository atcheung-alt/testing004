"use client";

import Link from "next/link";
import clsx from "clsx";
import { eventBarColor } from "@/components/BookingEventsCalendar";
import { useT } from "@/lib/i18n/client";
import { formatDateLabel } from "@/lib/bookingFormat";

export type BookingEventListItem = {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

/** "24/08/2026" or "24/08/2026 – 26/08/2026" once an event spans more than
 *  one day. */
function dateRangeLabel(startDate: string, endDate: string): string {
  const start = formatDateLabel(startDate);
  const end = formatDateLabel(endDate);
  return start === end ? start : `${start} – ${end}`;
}

export default function BookingEventListClient({ events }: { events: BookingEventListItem[] }) {
  const t = useT();
  const shown = [...events].sort((a, b) => Number(b.active) - Number(a.active) || a.startDate.localeCompare(b.startDate));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-lg font-semibold text-ink">{t("Events")}</h2>
      <div className="flex flex-col gap-2">
        {shown.map((e) => {
          const color = eventBarColor(e.id);
          return (
            <Link
              key={e.id}
              href={`/bookings/${e.id}`}
              className={clsx(
                "event-ticket flex items-center gap-3 rounded-lg border px-3 py-3 no-underline transition-colors",
                e.active ? "border-line bg-surface hover:bg-paper" : "border-line/70 bg-paper/40 hover:bg-paper"
              )}
              style={e.active ? { boxShadow: `inset 4px 0 0 ${color}` } : undefined}
            >
              <span
                className="h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: e.active ? color : "rgb(var(--color-ink-faint))" }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span
                  className="inline-block max-w-full truncate rounded px-2 py-0.5 text-sm font-medium"
                  style={
                    e.active
                      ? { backgroundColor: color, color: "#fff" }
                      : { color: "rgb(var(--color-ink-muted))" }
                  }
                >
                  {e.name}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                  <span>{dateRangeLabel(e.startDate, e.endDate)}</span>
                  {e.description ? <span className="truncate">{e.description}</span> : null}
                </span>
              </span>
              {e.active ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-[soft-pulse_1.6s_ease-in-out_infinite]" />
                  {t("Active")}
                </span>
              ) : (
                <span className="stamp shrink-0 border-line text-ink-muted">{t("Inactive")}</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
