"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useAppLanguage, useSetAppLanguage, useT } from "@/lib/i18n/client";
import { htmlLang, SURVEY_LANGUAGE_COOKIE, type AppLanguage } from "@/lib/i18n/language";

type TherapistOption = { id: string; name: string };

const QUESTIONS = [
  { key: "overall", label: "Overall experience" },
  { key: "focus", label: "Care and attention" },
  { key: "pressure", label: "Suitability of pressure" },
  { key: "relief", label: "Relief after the session" },
] as const;

type ScoreKey = (typeof QUESTIONS)[number]["key"];
type Scores = Record<ScoreKey, number | null>;

const EMPTY_SCORES: Scores = { overall: null, focus: null, pressure: null, relief: null };

const LANGUAGES = [
  ["zh", "中文"],
  ["en", "English"],
] as const;

export default function MassageSurveyForm({
  token,
  therapists,
  eventName,
}: {
  token: string;
  therapists: TherapistOption[];
  eventName: string;
}) {
  const t = useT();
  const router = useRouter();
  const language = useAppLanguage();
  const setLanguage = useSetAppLanguage();
  const [timeSlot, setTimeSlot] = useState("");
  const [nickname, setNickname] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [scores, setScores] = useState<Scores>(EMPTY_SCORES);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.documentElement.lang = htmlLang(language);
  }, [language]);

  function chooseLanguage(next: AppLanguage) {
    if (next === language) return;
    document.cookie = `${SURVEY_LANGUAGE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = htmlLang(next);
    setLanguage(next);
    router.refresh();
  }

  function reset() {
    setTimeSlot("");
    setNickname("");
    setTherapistId("");
    setScores(EMPTY_SCORES);
    setComment("");
    setError("");
    setDone(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!timeSlot.trim() || !nickname.trim() || !therapistId || QUESTIONS.some((question) => scores[question.key] == null)) {
      setError(t("Please complete the timeslot, name, therapist, and every rating."));
      return;
    }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/public/massage-survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeSlot: timeSlot.trim(),
          nickname: nickname.trim(),
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
        setError(t("We could not submit this form. Please try again."));
        return;
      }
      setDone(true);
    } catch {
      setError(t("We could not submit this form. Please try again."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-brand-700">{t("Guest feedback")}</p>
          <div className="flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label={t("Language")}>
            {LANGUAGES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => chooseLanguage(value)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  language === value ? "bg-brand-600 text-white" : "text-ink-muted"
                )}
                aria-pressed={language === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink mt-3">{t("Session Feedback")}</h1>
        <p className="mt-3 text-sm text-ink">
          {t("Your rating keeps every session to the same standard.")}
        </p>
        <p className="mt-3 text-sm text-ink-muted">{t("Please rate this session. It takes about a minute.")}</p>
        {eventName ? (
          <p className="mt-4 text-xs text-ink-muted">
            <span className="font-medium text-ink">{t("This session")}</span>
            <span className="mx-2 text-ink-faint">/</span>
            {eventName}
          </p>
        ) : null}
      </header>

      {done ? (
        <div className="bg-surface border border-line rounded-card shadow-card px-6 py-12 sm:px-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-brand-300 bg-brand-50 text-brand-700">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4.5 10.5 8 14l7.5-8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink">{t("Thank You for Your Feedback")}</h2>
          <p className="text-sm text-ink-muted mt-3 max-w-sm mx-auto">
            {t("Your response has been recorded and will be used to review this session.")}
          </p>
          <button type="button" className="btn-secondary mt-8" onClick={reset}>
            {t("Start another response")}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
          <div className="px-5 py-6 sm:px-7 sm:py-7 flex flex-col gap-8">
            <Section index="01" title={t("Session Details")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="timeslot">
                    {t("Timeslot")}
                  </label>
                  <input
                    id="timeslot"
                    className="input text-base"
                    value={timeSlot}
                    maxLength={80}
                    placeholder={t("e.g. 10:30")}
                    onChange={(event) => setTimeSlot(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5" htmlFor="nickname">
                    {t("Preferred name")}
                  </label>
                  <input
                    id="nickname"
                    className="input text-base"
                    value={nickname}
                    maxLength={80}
                    placeholder={t("For example, Amy")}
                    onChange={(event) => setNickname(event.target.value)}
                    required
                    autoComplete="nickname"
                  />
                </div>
              </div>
            </Section>

            <Section index="02" title={t("Your Therapist")}>
              <label className="sr-only" htmlFor="therapist">
                {t("Your Therapist")}
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
            </Section>

            <Section index="03" title={t("Ratings")}>
              <div className="flex justify-between text-xs text-ink-faint">
                <span>1 · {t("Unsatisfactory")}</span>
                <span>5 · {t("Excellent")}</span>
              </div>
              <div className="flex flex-col gap-5">
                {QUESTIONS.map((question, index) => (
                  <fieldset key={question.key}>
                    <legend className="text-sm font-medium text-ink mb-2">
                      <span className="mr-2 font-mono text-xs text-ink-faint">{index + 1}</span>
                      {t(question.label)}
                    </legend>
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
                              "h-11 rounded-lg border text-sm font-semibold",
                              selected
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-line bg-paper text-ink"
                            )}
                          >
                            {score}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </Section>

            <Section index="04" title={t("Additional Comments")}>
              <label className="sr-only" htmlFor="comment">
                {t("Additional Comments")}
              </label>
              <textarea
                id="comment"
                className="input text-base min-h-24"
                maxLength={500}
                value={comment}
                placeholder={t("A short note is welcome.")}
                onChange={(event) => setComment(event.target.value)}
              />
              <p className="text-xs text-ink-faint">{t("Optional")}</p>
            </Section>

            {error ? (
              <p className="text-sm text-danger-500" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn-primary h-12 text-base w-full" disabled={sending}>
              {sending ? t("Submitting…") : t("Submit feedback")}
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-xs text-ink-faint">{t("Reviewed internally. Not shown to other guests.")}</p>
    </div>
  );
}

function Section({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 border-b border-line pb-2">
        <span className="font-sans text-xs text-brand-700">{index}</span>
        <h2 className="font-sans text-sm font-semibold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}
