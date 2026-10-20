"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

type TherapistOption = { id: string; name: string };

export type MassageSurveyRecord = {
  id: string;
  therapistId: string;
  therapistName: string;
  guestNickname: string;
  timeSlot: string;
  overall: number;
  focus: number;
  pressure: number;
  relief: number;
  comment: string;
  when: string;
  score: string;
};

type Draft = {
  therapistId: string;
  guestNickname: string;
  timeSlot: string;
  overall: number;
  focus: number;
  pressure: number;
  relief: number;
  comment: string;
};

const SCORE_FIELDS = [
  ["overall", "Overall"],
  ["focus", "Care"],
  ["pressure", "Pressure"],
  ["relief", "Relief"],
] as const;

export default function MassageSurveyRecords({
  surveys,
  therapists,
}: {
  surveys: MassageSurveyRecord[];
  therapists: TherapistOption[];
}) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return surveys;
    return surveys.filter((survey) =>
      [survey.therapistName, survey.guestNickname, survey.timeSlot, survey.comment, survey.when]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, surveys]);

  function startEdit(survey: MassageSurveyRecord) {
    setPendingDeleteId(null);
    setError("");
    setEditingId(survey.id);
    setDraft({
      therapistId: survey.therapistId,
      guestNickname: survey.guestNickname,
      timeSlot: survey.timeSlot,
      overall: survey.overall,
      focus: survey.focus,
      pressure: survey.pressure,
      relief: survey.relief,
      comment: survey.comment,
    });
  }

  async function save(id: string) {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/massage/surveys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setError(t("Could not update this survey."));
        return;
      }
      setEditingId(null);
      setDraft(null);
      router.refresh();
    } catch {
      setError(t("Could not update this survey."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/massage/surveys/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setError(t("Could not delete this survey."));
        return;
      }
      setPendingDeleteId(null);
      router.refresh();
    } catch {
      setError(t("Could not delete this survey."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="survey-search">
        {t("Search these surveys")}
      </label>
      <input
        id="survey-search"
        type="search"
        className="input"
        value={query}
        placeholder={t("Search these surveys")}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length === 0 ? (
        <p className="card px-5 py-8 text-sm text-ink-muted text-center">{t("No matching surveys.")}</p>
      ) : (
        <div className="card divide-y divide-line">
          {shown.map((survey) => {
            const who = [survey.guestNickname, survey.timeSlot].filter(Boolean).join(" · ");
            const editing = editingId === survey.id && draft;
            const therapistOptions = therapists.some((therapist) => therapist.id === (draft?.therapistId ?? survey.therapistId))
              ? therapists
              : [{ id: survey.therapistId, name: survey.therapistName }, ...therapists];
            return (
              <article key={survey.id} className="px-4 sm:px-5 py-4 flex flex-col gap-3">
                {editing && draft ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">{t("Nickname")}</span>
                        <input
                          className="input"
                          maxLength={80}
                          value={draft.guestNickname}
                          onChange={(event) => setDraft({ ...draft, guestNickname: event.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium">{t("Timeslot")}</span>
                        <input
                          className="input"
                          maxLength={80}
                          value={draft.timeSlot}
                          onChange={(event) => setDraft({ ...draft, timeSlot: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">{t("Therapist")}</span>
                      <select
                        className="input"
                        value={draft.therapistId}
                        onChange={(event) => setDraft({ ...draft, therapistId: event.target.value })}
                      >
                        {therapistOptions.map((therapist) => (
                          <option key={therapist.id} value={therapist.id}>
                            {therapist.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {SCORE_FIELDS.map(([key, label]) => (
                        <label key={key} className="flex flex-col gap-1.5 text-sm">
                          <span className="font-medium">{t(label)}</span>
                          <select
                            className="input"
                            value={draft[key]}
                            onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
                          >
                            {[1, 2, 3, 4, 5].map((score) => (
                              <option key={score} value={score}>
                                {score}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <label className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">{t("Comment")}</span>
                      <textarea
                        className="input min-h-20"
                        maxLength={500}
                        value={draft.comment}
                        onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" disabled={busy} onClick={() => save(survey.id)}>
                        {busy ? t("Saving…") : t("Save changes")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        {t("Cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium">{survey.therapistName}</h3>
                      <p className="font-mono text-lg text-brand-700">{survey.score}</p>
                    </div>
                    <p className="text-xs text-ink-muted -mt-1">
                      {who ? `${who} · ` : ""}
                      {survey.when}
                    </p>
                    <p className="text-sm text-ink">
                      {t("Overall")} {survey.overall} · {t("Care")} {survey.focus} · {t("Pressure")} {survey.pressure} ·{" "}
                      {t("Relief")} {survey.relief}
                    </p>
                    {survey.comment ? <p className="text-sm text-ink-muted">{survey.comment}</p> : null}
                    {pendingDeleteId === survey.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-ink-muted">{t("This removes the guest's scores from this event.")}</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-danger" disabled={busy} onClick={() => remove(survey.id)}>
                            {t("Confirm delete")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busy}
                            onClick={() => setPendingDeleteId(null)}
                          >
                            {t("Cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary" onClick={() => startEdit(survey)}>
                          {t("Edit survey")}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setEditingId(null);
                            setDraft(null);
                            setPendingDeleteId(survey.id);
                          }}
                        >
                          {t("Delete survey")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
      {error ? <p className="text-sm text-danger-500">{error}</p> : null}
    </div>
  );
}
