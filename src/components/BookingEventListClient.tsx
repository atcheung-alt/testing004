"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
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
      <div className="w-full space-y-4 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{t("Events")}</h2>
          <p className="text-xs font-medium text-slate-400">
            {query.trim() ? t("{count} Matching", { count: shown.length }) : t("{count} Events", { count: events.length })}
          </p>
        </div>
        <label className="relative block max-w-sm" htmlFor="booking-event-search">
          <span className="sr-only">{t("Search by event name or date")}</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="booking-event-search"
            type="search"
            value={query}
            placeholder={t("Search by event name or date")}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-4 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>
        <div className="booking-events-scroll divide-y divide-slate-100">
          {shown.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">{t("No matching events.")}</p>
          ) : (
            shown.map((event) => (
              <Link
                key={event.id}
                href={`/bookings/${event.id}`}
                className="flex items-center justify-between gap-3 py-3.5 no-underline"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-800">{event.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-400">
                    {dateRangeLabel(event.startDate, event.endDate)}
                    {event.description ? ` ${event.description}` : ""}
                  </span>
                </span>
                <span
                  className={clsx(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider",
                    event.active ? "border-indigo-200 bg-indigo-50/50 text-indigo-600" : "border-slate-200 bg-slate-50 text-slate-400"
                  )}
                >
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
