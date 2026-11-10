"use client";

import { useState, type ReactNode } from "react";
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

const STARTER_SLOTS = ["09:30 – 10:30", "10:30 – 11:30", "14:00 – 15:00", "15:00 – 16:00"];

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
  const [creating, setCreating] = useState(events.length === 0);
  const [name, setName] = useState(open?.name || "");
  const [eventDate, setEventDate] = useState(open?.eventDate || "");
  const [questions, setQuestions] = useState<string[]>(open?.questions || []);
  const [slots, setSlots] = useState<string[]>(open?.slots?.length ? open.slots : STARTER_SLOTS);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftSlot, setDraftSlot] = useState("");
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
      body: JSON.stringify({ name, eventDate, questions, slots }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not create the event.");
      return;
    }
    router.push(`/event-desk?id=${payload.event.id}`);
    router.refresh();
  }

  async function saveEvent() {
    if (!open) return;
    setError("");
    setSaving(true);
    const response = await fetch(`/api/event-desk/${open.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, eventDate, questions, slots }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not save.");
      return;
    }
    router.refresh();
  }

  function addQuestion() {
    const next = draftQuestion.trim();
    if (!next || questions.includes(next)) return;
    setQuestions([...questions, next]);
    setDraftQuestion("");
  }

  function addSlot() {
    const next = draftSlot.trim();
    if (!next || slots.includes(next)) return;
    setSlots([...slots, next]);
    setDraftSlot("");
  }

  if (!open) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl">Events</h1>
            <p className="lead mt-2">One event per client. Open an event to change its questions.</p>
          </div>
          <button type="button" className="btn-primary shrink-0" onClick={() => setCreating(true)}>
            New event
          </button>
        </div>

        <div className="card mt-5 divide-y divide-line">
          {events.length === 0 && <p className="p-5 text-sm text-ink-muted">No events yet.</p>}
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => router.push(`/event-desk?id=${event.id}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-paper"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{event.name}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">
                  {event.eventDate || "Date not set"} · {event.booked} booked
                </span>
              </span>
              <span className="stamp shrink-0 border-line text-ink-muted">Edit</span>
            </button>
          ))}
        </div>

        {creating && (
          <section className="card mt-5 p-5">
            <h2 className="text-base font-semibold">New event</h2>
            <p className="mt-1 text-sm text-ink-muted">Name, email, and a time are always on the candidate form. Add only the extra questions.</p>
            <Field label="Event name">
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Harbour Bank career day" />
            </Field>
            <Field label="Date">
              <input className="input" value={eventDate} onChange={(event) => setEventDate(event.target.value)} placeholder="18 Nov 2026" />
            </Field>
            <QuestionList
              questions={questions}
              draft={draftQuestion}
              onDraft={setDraftQuestion}
              onAdd={addQuestion}
              onChange={(index, value) => setQuestions(questions.map((item, i) => (i === index ? value : item)))}
              onRemove={(index) => setQuestions(questions.filter((_, i) => i !== index))}
            />
            <SlotList
              slots={slots}
              draft={draftSlot}
              onDraft={setDraftSlot}
              onAdd={addSlot}
              onChange={(index, value) => setSlots(slots.map((item, i) => (i === index ? value : item)))}
              onRemove={(index) => setSlots(slots.filter((_, i) => i !== index))}
            />
            {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={createEvent}>
                Create event
              </button>
              {events.length > 0 && (
                <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  const arrived = open.bookings.filter((booking) => booking.arrived).length;

  return (
    <div className="max-w-3xl">
      <button type="button" className="text-sm text-ink-muted" onClick={() => router.push("/event-desk")}>
        ← Events
      </button>
      <h1 className="font-display text-2xl mt-3">{open.name}</h1>
      <p className="lead mt-2">
        {open.bookings.length} booked · {arrived} arrived
      </p>

      <section className="card mt-5 p-5">
        <h2 className="text-base font-semibold">Event</h2>
        <Field label="Name">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Date">
          <input className="input" value={eventDate} onChange={(event) => setEventDate(event.target.value)} placeholder="18 Nov 2026" />
        </Field>
        <QuestionList
          questions={questions}
          draft={draftQuestion}
          onDraft={setDraftQuestion}
          onAdd={addQuestion}
          onChange={(index, value) => setQuestions(questions.map((item, i) => (i === index ? value : item)))}
          onRemove={(index) => setQuestions(questions.filter((_, i) => i !== index))}
        />
        <SlotList
          slots={slots}
          draft={draftSlot}
          onDraft={setDraftSlot}
          onAdd={addSlot}
          onChange={(index, value) => setSlots(slots.map((item, i) => (i === index ? value : item)))}
          onRemove={(index) => setSlots(slots.filter((_, i) => i !== index))}
        />
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <button type="button" className="btn-primary mt-5" disabled={saving} onClick={saveEvent}>
          Save changes
        </button>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="text-base font-semibold">Links</h2>
        <div className="mt-4 space-y-4">
          <LinkRow label="Candidate link" url={open.joinUrl} copied={copied === "join"} onCopy={async () => setCopied((await copy(open.joinUrl)) ? "join" : "")} />
          <LinkRow label="Client manager link" url={open.hostUrl} copied={copied === "host"} onCopy={async () => setCopied((await copy(open.hostUrl)) ? "host" : "")} />
          <LinkRow label="Door QR link" url={open.doorUrl} copied={copied === "door"} onCopy={async () => setCopied((await copy(open.doorUrl)) ? "door" : "")} />
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="px-4 pt-4 text-base font-semibold">Bookings</h2>
        <div className="mt-2 divide-y divide-line">
          {open.bookings.length === 0 && <p className="px-4 py-5 text-sm text-ink-muted">No bookings yet.</p>}
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
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block">
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function QuestionList({
  questions,
  draft,
  onDraft,
  onAdd,
  onChange,
  onRemove,
}: {
  questions: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Extra questions</p>
      <p className="mt-1 text-sm text-ink-muted">Name, email, and time slot stay on the form. These are the extra ones.</p>
      <div className="mt-3 space-y-2">
        {questions.map((question, index) => (
          <div key={index} className="flex items-center gap-2">
            <input className="input" value={question} onChange={(event) => onChange(index, event.target.value)} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => onRemove(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className="input" value={draft} onChange={(event) => onDraft(event.target.value)} placeholder="Phone" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} />
        <button type="button" className="btn-secondary shrink-0" onClick={onAdd}>
          Add
        </button>
      </div>
    </div>
  );
}

function SlotList({
  slots,
  draft,
  onDraft,
  onAdd,
  onChange,
  onRemove,
}: {
  slots: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">Time slots</p>
      <p className="mt-1 text-sm text-ink-muted">Each time holds 200 people.</p>
      <div className="mt-3 space-y-2">
        {slots.map((slot, index) => (
          <div key={index} className="flex items-center gap-2">
            <input className="input" value={slot} onChange={(event) => onChange(index, event.target.value)} />
            <button type="button" className="btn-secondary shrink-0" onClick={() => onRemove(index)}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input className="input" value={draft} onChange={(event) => onDraft(event.target.value)} placeholder="16:00 – 17:00" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onAdd(); } }} />
        <button type="button" className="btn-secondary shrink-0" onClick={onAdd}>
          Add
        </button>
      </div>
    </div>
  );
}

function LinkRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 truncate rounded-xl bg-paper px-3 py-2 font-mono text-xs">{url}</p>
      </div>
      <button type="button" className="btn-secondary shrink-0" onClick={onCopy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
