"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAppLanguage, useSetAppLanguage, useT } from "@/lib/i18n/client";
import { htmlLang, LANGUAGE_COOKIE, type AppLanguage } from "@/lib/i18n/language";

type TherapistOption = { id: string; name: string };

const QUESTIONS = [
  { key: "overall", label: "How did this massage feel overall?" },
  { key: "focus", label: "Did the therapist put care into the session?" },
  { key: "pressure", label: "Was the pressure right for you?" },
  { key: "relief", label: "Did your discomfort ease afterward?" },
] as const;

type ScoreKey = (typeof QUESTIONS)[number]["key"];
type Scores = Record<ScoreKey, number | null>;

const EMPTY_SCORES: Scores = { overall: null, focus: null, pressure: null, relief: null };

export default function MassageSurveyForm({
  token,
  therapists,
}: {
  token: string;
  therapists: TherapistOption[];
}) {
  const t = useT();
  const router = useRouter();
  const language = useAppLanguage();
  const setLanguage = useSetAppLanguage();
  const [therapistId, setTherapistId] = useState("");
  const [scores, setScores] = useState<Scores>(EMPTY_SCORES);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function chooseLanguage(next: AppLanguage) {
    if (next === language) return;
    document.cookie = `${LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
    setLanguage(next);
    router.refresh();
  }

  function reset() {
    setTherapistId("");
    setScores(EMPTY_SCORES);
    setComment("");
    setError("");
    setDone(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!therapistId || QUESTIONS.some((question) => scores[question.key] == null)) {
      setError(t("Please choose a therapist and score every question."));
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/public/massage-survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapistId,
          overall: scores.overall,
          focus: scores.focus,
          pressure: scores.pressure,
          relief: scores.relief,
          comment,
          language,
        }),
      });
      if (!response.ok) {
        setError(t("Could not send feedback. Please try again."));
        return;
      }
      setDone(true);
    } catch {
      setError(t("Could not send feedback. Please try again."));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6 sm:p-8 text-center">
        <h2 className="font-display text-2xl font-semibold mb-2">{t("Thank you")}</h2>
        <p className="text-sm text-ink-muted mb-6">
          {t("Your feedback helps us recognise therapists who put care into the session.")}
        </p>
        <button type="button" className="btn-primary" onClick={reset}>
          {t("Fill in for the next guest")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 sm:p-6 flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Language">
        {(
          [
            ["zh", "中文"],
            ["en", "English"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => chooseLanguage(value)}
            className={clsx(
              "rounded-xl border px-3 py-3 text-sm font-medium",
              language === value
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-line text-ink-muted"
            )}
            aria-pressed={language === value}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="therapist">
          {t("Which therapist massaged you?")}
        </label>
        <select
          id="therapist"
          className="input text-base"
          value={therapistId}
          onChange={(event) => setTherapistId(event.target.value)}
          required
        >
          <option value="">{t("Select a therapist")}</option>
          {therapists.map((therapist) => (
            <option key={therapist.id} value={therapist.id}>
              {therapist.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-ink-muted -mt-2">{t("1 is poor. 5 is excellent.")}</p>

      {QUESTIONS.map((question) => (
        <fieldset key={question.key}>
          <legend className="label">{t(question.label)}</legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t(question.label)}>
            {[1, 2, 3, 4, 5].map((score) => {
              const selected = scores[question.key] === score;
              return (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setScores((current) => ({ ...current, [question.key]: score }))}
                  className={clsx(
                    "h-12 rounded-xl border text-base font-semibold",
                    selected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-line bg-surface text-ink"
                  )}
                >
                  {score}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <label className="label" htmlFor="comment">
          {t("Any other comments?")}
          <span className="font-normal normal-case tracking-normal text-ink-faint"> · {t("Optional")}</span>
        </label>
        <textarea
          id="comment"
          className="input text-base min-h-24"
          maxLength={500}
          value={comment}
          placeholder={t("One sentence is enough.")}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      {error && <p className="text-sm text-danger-500">{error}</p>}

      <button type="submit" className="btn-primary h-12 text-base" disabled={sending}>
        {sending ? t("Submitting…") : t("Send feedback")}
      </button>
    </form>
  );
}
