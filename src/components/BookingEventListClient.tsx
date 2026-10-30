"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
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
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...events]
      .filter((event) => {
        if (!needle) return true;
        return [event.name, event.description, dateRangeLabel(event.startDate, event.endDate)]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  }, [events, query]);

  return (
    <section className="booking-events">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-sans text-lg font-semibold text-ink">{t("Events")}</h2>
            <p className="text-sm text-ink-muted">
              {query.trim() ? t("{count} Matching", { count: shown.length }) : t("{count} Events", { count: events.length })}
            </p>
          </div>
          <label className="sr-only" htmlFor="booking-event-search">
            {t("Search by event name or date")}
          </label>
          <input
            id="booking-event-search"
            type="search"
            className="input"
            value={query}
            placeholder={t("Search by event name or date")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="booking-events-scroll">
          {shown.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">{t("No matching events.")}</p>
          ) : (
            shown.map((event) => (
              <Link
                key={event.id}
                href={`/bookings/${event.id}`}
                className="event-ticket flex items-center gap-3 border-b border-line px-4 py-3 no-underline last:border-b-0 hover:bg-paper sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-base font-semibold text-ink">{event.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink">
                    <span>{dateRangeLabel(event.startDate, event.endDate)}</span>
                    {event.description ? <span className="truncate">{event.description}</span> : null}
                  </span>
                </span>
                <span className={clsx("stamp shrink-0", event.active ? "border-brand-500 text-brand-600" : "border-line bg-paper text-ink")}>
                  {event.active ? t("Active") : t("Inactive")}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
