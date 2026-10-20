"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export type MassageEventChoice = {
  id: string;
  name: string;
  detail: string;
  score: string;
  surveyCount: number;
};

function eventLabel(event: MassageEventChoice): string {
  return `${event.name} ${event.detail}`;
}

export default function MassageEventSearch({ events }: { events: MassageEventChoice[] }) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) => eventLabel(event).toLowerCase().includes(needle));
  }, [events, query]);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-3 border-b border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-ink-muted">{t("{count} events", { count: events.length })}</p>
          {query.trim() ? (
            <p className="text-xs text-ink-faint">{t("{count} matching", { count: shown.length })}</p>
          ) : null}
        </div>
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
        <label className="sr-only" htmlFor="massage-event-select">
          {t("Select an event")}
        </label>
        <select
          id="massage-event-select"
          className="input"
          value=""
          onChange={(event) => {
            if (event.target.value) router.push(`/massage/${event.target.value}`);
          }}
        >
          <option value="">{t("Select an event")}</option>
          {shown.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
              {event.detail ? ` · ${event.detail}` : ""}
              {` · ${event.score} · ${t("{count} surveys", { count: event.surveyCount })}`}
            </option>
          ))}
        </select>
        {shown.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No matching events.")}</p>
        ) : null}
      </div>
    </div>
  );
}
