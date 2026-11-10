"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

export type DeskEventSummary = { id: string; name: string; eventDate: string; booked: number };
export type DeskBookingView = {
  id: string;
  name: string;
  email: string;
  answers: Record<string, string>;
  slot: string;
  arrived: boolean;
};
export type DeskEventView = {
  id: string;
  name: string;
  eventDate: string;
  questions: string[];
  slots: string[];
  joinUrl: string;
  hostUrl: string;
  doorUrl: string;
  bookings: DeskBookingView[];
};

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function EventDesk({ events, open }: { events: DeskEventSummary[]; open: DeskEventView | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [question, setQuestion] = useState("");
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [saving, setSaving] = useState(false);

  async function createEvent() {
    setError("");
    if (!name.trim()) {
      setError("Enter an event name.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/event-desk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventDate }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not create the event.");
      return;
    }
    setName("");
    setEventDate("");
    router.push(`/event-desk?id=${payload.event.id}`);
    router.refresh();
  }

  async function save(body: Record<string, unknown>) {
    if (!open) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/event-desk/${open.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Could not save.");
      return;
    }
    router.refresh();
  }

  const arrived = open?.bookings.filter((booking) => booking.arrived).length || 0;

  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold text-brand-500">HR Plus</p>
      <h1 className="font-display text-2xl mt-2">Your events</h1>
      <p className="lead mt-2">
        Make one event per client. Each event has its own questions, a candidate link, a manager link, and a door QR code.
      </p>

      <div className="card mt-4 divide-y divide-line">
        {events.length === 0 && <p className="p-5 text-sm text-ink-muted">No events yet.</p>}
        {events.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => router.push(`/event-desk?id=${event.id}`)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper"
          >
            <span className="min-w-0">
              <b className="block truncate">{event.name}</b>
              <span className="text-sm text-ink-muted">
                {event.eventDate || "Date not set"} · {event.booked} booked
              </span>
            </span>
            <span className={clsx("stamp shrink-0", open?.id === event.id ? "border-brand-500 text-brand-500" : "border-line text-ink-muted")}>
              Open
            </span>
          </button>
        ))}
      </div>

      <div className="card mt-4 p-5">
        <p className="text-sm text-ink-muted">New event</p>
        <label className="mt-3 block text-sm font-semibold">Event name</label>
        <input className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Client company + event" />
        <label className="mt-3 block text-sm font-semibold">Date</label>
        <input className="input mt-1.5" value={eventDate} onChange={(event) => setEventDate(event.target.value)} placeholder="18 Nov 2026" />
        {error && !open && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <button type="button" className="btn-primary mt-4 w-full" disabled={saving} onClick={createEvent}>
          Create event
        </button>
      </div>

      {open && (
        <>
          <div className="card mt-4 p-5">
            <p className="text-sm text-ink-muted">
              Questions for {open.name}. Name, email, and time slot are always asked.
            </p>
            {open.questions.map((item) => (
              <div key={item} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <b>{item}</b>
                <button type="button" className="text-sm text-ink-muted" onClick={() => save({ questions: open.questions.filter((q) => q !== item) })}>
                  Remove
                </button>
              </div>
            ))}
            <label className="mt-3 block text-sm font-semibold">Add a question</label>
            <input className="input mt-1.5" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. Phone" />
            <button
              type="button"
              className="btn-secondary mt-3 w-full"
              onClick={() => {
                const next = question.trim();
                if (!next || open.questions.includes(next)) return;
                setQuestion("");
                save({ questions: [...open.questions, next] });
              }}
            >
              Add question
            </button>
          </div>

          <div className="card mt-4 p-5">
            <p className="text-sm text-ink-muted">Time slots. Each slot holds 200 people.</p>
            {open.slots.map((item) => (
              <div key={item} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <b>{item}</b>
                <button type="button" className="text-sm text-ink-muted" onClick={() => save({ slots: open.slots.filter((time) => time !== item) })}>
                  Remove
                </button>
              </div>
            ))}
            <label className="mt-3 block text-sm font-semibold">Add a time</label>
            <input className="input mt-1.5" value={slot} onChange={(event) => setSlot(event.target.value)} placeholder="16:00 – 17:00" />
            <button
              type="button"
              className="btn-secondary mt-3 w-full"
              onClick={() => {
                const next = slot.trim();
                if (!next || open.slots.includes(next)) return;
                setSlot("");
                save({ slots: [...open.slots, next] });
              }}
            >
              Add time
            </button>
          </div>

          <div className="card mt-4 space-y-4 p-5">
            <LinkRow label="Candidate link" url={open.joinUrl} copied={copied} onCopy={async () => setCopied((await copy(open.joinUrl)) ? "join" : "")} which="join" />
            <LinkRow label="Client manager link" url={open.hostUrl} copied={copied} onCopy={async () => setCopied((await copy(open.hostUrl)) ? "host" : "")} which="host" />
            <LinkRow label="Door QR link" url={open.doorUrl} copied={copied} onCopy={async () => setCopied((await copy(open.doorUrl)) ? "door" : "")} which="door" />
            <p className="text-sm text-ink-muted">
              {open.bookings.length} booked · {arrived} arrived. The manager page updates on its own when someone books or scans the QR.
            </p>
            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>

          <div className="card mt-4 divide-y divide-line">
            {open.bookings.length === 0 && <p className="p-5 text-sm text-ink-muted">No bookings yet.</p>}
            {open.bookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{booking.name}</p>
                  <p className="truncate text-sm text-ink-muted">
                    {booking.email} · {booking.slot}
                    {Object.entries(booking.answers)
                      .filter(([, value]) => value)
                      .map(([key, value]) => ` · ${key}: ${value}`)
                      .join("")}
                  </p>
                </div>
                <span className={clsx("stamp shrink-0", booking.arrived ? "border-emerald-600 text-emerald-700" : "border-line text-ink-muted")}>
                  {booking.arrived ? "Arrived" : "Booked"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LinkRow({
  label,
  url,
  copied,
  which,
  onCopy,
}: {
  label: string;
  url: string;
  copied: string;
  which: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 break-all rounded-xl bg-paper px-3 py-2 font-mono text-xs">{url}</p>
      <button type="button" className="btn-secondary mt-2" onClick={onCopy}>
        {copied === which ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
