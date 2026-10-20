"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { TherapistStanding } from "@/lib/massage";

const PARTS = [
  { key: "overall", label: "Overall", bar: "bg-brand-500" },
  { key: "focus", label: "Care", bar: "bg-cyan-500" },
  { key: "pressure", label: "Pressure", bar: "bg-accent-500" },
  { key: "relief", label: "Relief", bar: "bg-brand-300" },
] as const;

export type ScoreNote = {
  id: string;
  therapistId: string;
  guestNickname: string;
  timeSlot: string;
  comment: string;
  when: string;
};

export default function MassageScoreLookup({
  rows,
  notes,
}: {
  rows: TherapistStanding[];
  notes: ScoreNote[];
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [commentId, setCommentId] = useState("");

  const people = useMemo(
    () => rows.filter((row) => row.count > 0).sort((a, b) => a.name.localeCompare(b.name, "zh-HK")),
    [rows]
  );
  const notesFor = useMemo(() => {
    const grouped = new Map<string, ScoreNote[]>();
    for (const note of notes) {
      const list = grouped.get(note.therapistId) ?? [];
      list.push(note);
      grouped.set(note.therapistId, list);
    }
    return grouped;
  }, [notes]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((row) => {
      if (row.name.toLowerCase().includes(needle)) return true;
      return (notesFor.get(row.id) ?? []).some((note) =>
        [note.comment, note.guestNickname, note.timeSlot].join(" ").toLowerCase().includes(needle)
      );
    });
  }, [notesFor, people, query]);
  const selected = people.find((row) => row.id === selectedId) ?? null;
  const writtenNotes = (selected ? notesFor.get(selected.id) ?? [] : []).filter((note) => note.comment.trim());
  const chosenNote = writtenNotes.find((note) => note.id === commentId) ?? null;

  useEffect(() => {
    if (!query.trim() || shown.length !== 1) return;
    setSelectedId(shown[0].id);
  }, [query, shown]);

  useEffect(() => {
    setCommentId("");
  }, [selectedId]);

  return (
    <section className="flex flex-col gap-3">
      <div className="massage-heading-plate">
        <h3 className="font-sans text-lg font-semibold text-ink">{t("Look Up a Score")}</h3>
        <p className="lead">{t("Search a name to see scores and comments.")}</p>
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
                  {t("{count} Surveys", { count: selected.count })}
                  {selected.early ? ` · ${t("Early")}` : ""}
                </p>
              </div>
              <p className="font-mono text-lg text-brand-700">{selected.adjusted.toFixed(1)} / 5</p>
            </div>
            {writtenNotes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <label className="label" htmlFor="score-comment-select">
                  {t("Comment")}
                </label>
                <select
                  id="score-comment-select"
                  className="input"
                  value={writtenNotes.some((note) => note.id === commentId) ? commentId : ""}
                  onChange={(event) => setCommentId(event.target.value)}
                >
                  <option value="">{t("Select a comment")}</option>
                  {writtenNotes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {[note.timeSlot, note.when].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
                {chosenNote ? <p className="text-sm whitespace-pre-wrap">{chosenNote.comment}</p> : null}
              </div>
            ) : null}
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
