"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export type MassageEventChoice = {
  id: string;
  name: string;
  detail: string;
  score: string;
  surveyCount: number;
};

export default function MassageEventSearch({ events }: { events: MassageEventChoice[] }) {
  const t = useT();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => `${event.name} ${event.detail}`.toLowerCase().includes(needle));
  }, [events, query]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5">
        <p className="text-sm text-ink-muted">
          {query.trim() ? t("{count} Matching", { count: shown.length }) : t("{count} Events", { count: events.length })}
        </p>
        <label className="sr-only" htmlFor="massage-event-search">
          {t("Search by event, client, invoice, or date")}
        </label>
        <input
          id="massage-event-search"
          type="search"
          className="input"
          value={query}
          placeholder={t("Search by event, client, invoice, or date")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div>
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">{t("No matching events.")}</p>
        ) : (
          shown.map((event) => (
            <Link
              key={event.id}
              href={`/massage/${event.id}`}
              className="event-ticket flex items-center gap-3 border-b border-line px-4 py-3 no-underline last:border-b-0 hover:bg-paper sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-sm font-semibold text-ink">{event.name}</span>
                {event.detail ? <span className="mt-0.5 block truncate text-sm text-ink-muted">{event.detail}</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-sans text-sm font-semibold text-ink">{event.score}</span>
                <span className="block text-xs text-ink-muted">{t("{count} Surveys", { count: event.surveyCount })}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
