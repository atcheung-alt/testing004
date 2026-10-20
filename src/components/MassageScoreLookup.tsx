"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { TherapistStanding } from "@/lib/massage";

const PARTS = [
  { key: "overall", label: "Overall", bar: "bg-brand-500" },
  { key: "focus", label: "Care", bar: "bg-cyan-500" },
  { key: "pressure", label: "Pressure", bar: "bg-accent-500" },
  { key: "relief", label: "Relief", bar: "bg-brand-300" },
] as const;

export default function MassageScoreLookup({ rows }: { rows: TherapistStanding[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const people = useMemo(
    () => rows.filter((row) => row.count > 0).sort((a, b) => a.name.localeCompare(b.name, "zh-HK")),
    [rows]
  );
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((row) => row.name.toLowerCase().includes(needle));
  }, [people, query]);
  const selected = people.find((row) => row.id === selectedId) ?? null;

  return (
    <section className="flex flex-col gap-3 animate-rise" style={{ animationDelay: "380ms" }}>
      <div>
        <h3 className="font-display text-xl font-semibold">{t("Look up a score")}</h3>
        <p className="text-sm text-ink-muted mt-1">{t("Search a name, then choose them from the list.")}</p>
      </div>
      <div className="card px-4 sm:px-5 py-4 flex flex-col gap-3">
        <label className="sr-only" htmlFor="score-lookup-search">
          {t("Search by name")}
        </label>
        <input
          id="score-lookup-search"
          type="search"
          className="input"
          value={query}
          placeholder={t("Search by name")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="sr-only" htmlFor="score-lookup-select">
          {t("Select a person")}
        </label>
        <select
          id="score-lookup-select"
          className="input"
          value={shown.some((row) => row.id === selectedId) ? selectedId : ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">{t("Select a person")}</option>
          {shown.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
        {query.trim() && shown.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No matching names.")}</p>
        ) : null}
        {selected ? (
          <div className="border-t border-line pt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="font-medium">{selected.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {t("{count} surveys", { count: selected.count })}
                  {selected.early ? ` · ${t("Early")}` : ""}
                </p>
              </div>
              <p className="font-mono text-lg text-brand-700">{selected.adjusted.toFixed(1)} / 5</p>
            </div>
            <div className="relative h-2.5 rounded-full bg-paper overflow-hidden">
              <div
                key={selected.id}
                className="absolute inset-y-0 left-0 rounded-full bg-brand-500 animate-fill-bar"
                style={{ ["--bar" as string]: `${(selected.adjusted / 5) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {PARTS.map((part) => (
                <div key={part.key}>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted mb-1">
                    <span>{t(part.label)}</span>
                    <span className="font-mono">{selected[part.key].toFixed(1)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-paper overflow-hidden">
                    <div
                      key={`${selected.id}-${part.key}`}
                      className={`absolute inset-y-0 left-0 rounded-full animate-fill-bar ${part.bar}`}
                      style={{ ["--bar" as string]: `${(selected[part.key] / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
