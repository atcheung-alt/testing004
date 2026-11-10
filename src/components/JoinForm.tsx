"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export default function JoinForm({
  token,
  eventName,
  eventDate,
  questions,
  slots,
}: {
  token: string;
  eventName: string;
  eventDate: string;
  questions: { label: string; required: boolean }[];
  slots: { time: string; left: number }[];
}) {
  const [title, setTitle] = useState(eventName);
  const [when, setWhen] = useState(eventDate);
  const [fields, setFields] = useState(questions);
  const [times, setTimes] = useState(slots);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState("");
  const [hour, setHour] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; slot: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/public/desk-join/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      setTitle(next.name || "");
      setWhen(next.eventDate || "");
      setFields(Array.isArray(next.questions) ? next.questions : []);
      setTimes(Array.isArray(next.slots) ? next.slots : []);
      setSlot((current) => (next.slots?.some((item: { time: string }) => item.time === current) ? current : ""));
    }, 4000);
    return () => clearInterval(timer);
  }, [token]);

  async function book() {
    setError("");
    setSaving(true);
    const response = await fetch(`/api/public/desk-join/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, slot, answers }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "We could not send the confirmation email. Check the email address and try again.");
      return;
    }
    setDone(payload.booking);
  }

  if (done) {
    return (
      <div className="card mt-4 p-8 text-center">
        <h2 className="font-display text-2xl">You’re booked</h2>
        <p className="lead mt-2">
          {done.name}
          <br />
          {done.slot}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          A confirmation letter will be sent to <span className="font-semibold text-ink">{email}</span>.
        </p>
        <p className="mt-3 text-sm text-ink-muted">On the day, scan the event QR code at the door and enter this email to confirm you have arrived.</p>
      </div>
    );
  }

  const hours = Array.from(new Set(times.map((item) => item.time.slice(0, 2)))).sort();
  const openHour = hours.includes(hour) ? hour : hours[0] || "";
  const visible = times.filter((item) => item.time.startsWith(openHour));

  return (
    <>
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-sm font-semibold text-white">HR</span>
      <span>
        <span className="block text-sm font-semibold">HR Plus</span>
        <span className="block text-xs text-ink-muted">{title}</span>
      </span>
    </div>
    <h1 className="font-display text-2xl mt-4">Pick a time</h1>
    <p className="lead mt-2">{when || "Choose an hour, then one time slot."}</p>
    <div className="card mt-4 p-5">
      <label className="block text-sm font-semibold">Name</label>
      <input className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Chan Tai Man" />
      <label className="mt-3 block text-sm font-semibold">Email</label>
      <input className="input mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" />
      <p className="mt-1.5 text-sm text-ink-muted">Use an email you can receive mail on. The booking note is sent there.</p>
      {fields.map((question) => (
        <div key={question.label}>
          <label className="mt-3 block text-sm font-semibold">
            {question.label}
            {question.required ? "" : " (optional)"}
          </label>
          <input
            className="input mt-1.5"
            value={answers[question.label] || ""}
            onChange={(event) => setAnswers({ ...answers, [question.label]: event.target.value })}
          />
        </div>
      ))}
      <p className="mt-3 text-sm font-semibold">Time slot</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {hours.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setHour(item); setSlot(""); }}
            className={clsx("stamp", openHour === item ? "border-brand-500 text-brand-500" : "border-line text-ink-muted")}
          >
            {item}:00
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {visible.map((item) => (
          <button
            key={item.time}
            type="button"
            disabled={item.left <= 0}
            onClick={() => setSlot(item.time)}
            className={clsx(
              "rounded-full border px-3 py-2 text-sm",
              slot === item.time ? "border-brand-500 bg-brand-50 text-brand-500" : "border-line",
              item.left <= 0 && "opacity-45"
            )}
          >
            {item.time}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      <button type="button" className="btn-primary mt-4 w-full" disabled={saving} onClick={book}>
        Confirm booking
      </button>
    </div>
    </>
  );
}
