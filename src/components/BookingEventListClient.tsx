"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const recent = useMemo(
    () => [...events].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 3),
    [events]
  );
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recent;
    return [...events]
      .filter((event) =>
        [event.name, event.description, dateRangeLabel(event.startDate, event.endDate)].join(" ").toLowerCase().includes(needle)
      )
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [events, query, recent]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-sans text-lg font-semibold text-ink">{t("Events")}</h2>
      <div className="card px-4 sm:px-5 py-4 flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          {query.trim() ? t("{count} matching", { count: shown.length }) : t("The 3 most recent events.")}
        </p>
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
        <label className="sr-only" htmlFor="booking-event-select">
          {t("Select an event")}
        </label>
        <select
          id="booking-event-select"
          className="input"
          value=""
          onChange={(event) => {
            if (event.target.value) router.push(`/bookings/${event.target.value}`);
          }}
        >
          <option value="">{t("Select an event")}</option>
          {shown.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {` · ${dateRangeLabel(event.startDate, event.endDate)}`}
              {event.description ? ` · ${event.description}` : ""}
              {` · ${event.active ? t("Active") : t("Inactive")}`}
            </option>
          ))}
        </select>
        {shown.length === 0 ? <p className="text-sm text-ink-muted">{t("No matching events.")}</p> : null}
      </div>
    </section>
  );
}
