"use client";

import { useState } from "react";
import clsx from "clsx";

export default function JoinForm({
  token,
  questions,
  slots,
}: {
  token: string;
  questions: string[];
  slots: { time: string; left: number }[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; slot: string } | null>(null);
  const [saving, setSaving] = useState(false);

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
      setError(payload.error || "Could not book.");
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
        <p className="mt-3 text-sm text-ink-muted">On the day, scan the event QR code at the door and enter this email to confirm you have arrived.</p>
      </div>
    );
  }

  return (
    <div className="card mt-4 p-5">
      <label className="block text-sm font-semibold">Name</label>
      <input className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Chan Tai Man" />
      <label className="mt-3 block text-sm font-semibold">Email</label>
      <input className="input mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" />
      {questions.map((question) => (
        <div key={question}>
          <label className="mt-3 block text-sm font-semibold">{question}</label>
          <input
            className="input mt-1.5"
            value={answers[question] || ""}
            onChange={(event) => setAnswers({ ...answers, [question]: event.target.value })}
          />
        </div>
      ))}
      <p className="mt-3 text-sm font-semibold">Time slot</p>
      <div className="mt-2 space-y-2">
        {slots.map((item) => (
          <button
            key={item.time}
            type="button"
            disabled={item.left <= 0}
            onClick={() => setSlot(item.time)}
            className={clsx(
              "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left",
              slot === item.time ? "border-brand-500 bg-brand-50" : "border-line",
              item.left <= 0 && "opacity-45"
            )}
          >
            <span className="font-semibold">{item.time}</span>
            <span className="text-sm text-ink-muted">{item.left <= 0 ? "Full" : `${item.left} seats left`}</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      <button type="button" className="btn-primary mt-4 w-full" disabled={saving} onClick={book}>
        Confirm booking
      </button>
    </div>
  );
}
