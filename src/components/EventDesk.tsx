"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Plus, Search, X } from "lucide-react";
import clsx from "clsx";

export type DeskEventSummary = { id: string; code: string; name: string; eventDate: string; booked: number };
export type DeskBookingView = {
  id: string;
  name: string;
  email: string;
  answers: Record<string, string>;
  slot: string;
  arrived: boolean;
};
export type DeskQuestion = { label: string; required: boolean };
export type DeskEventView = {
  id: string;
  code: string;
  name: string;
  eventDate: string;
  slotCap: number;
  questions: DeskQuestion[];
  slots: string[];
  joinUrl: string;
  hostUrl: string;
  doorUrl: string;
  confirmFrom: string;
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

export default function EventDesk({
  events,
  open,
  senderEmail,
}: {
  events: DeskEventSummary[];
  open: DeskEventView | null;
  senderEmail: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(events.length === 0);
  const [name, setName] = useState(open?.name || "");
  const [eventDate, setEventDate] = useState(open?.eventDate || "");
  const [questions, setQuestions] = useState<DeskQuestion[]>(open?.questions || []);
  const [slots, setSlots] = useState<string[]>(open?.slots || []);
  const [slotCap, setSlotCap] = useState(open?.slotCap || 1);
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("17:00");
  const [durationAmount, setDurationAmount] = useState("30");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [askDelete, setAskDelete] = useState(false);
  const [qr, setQr] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open?.doorUrl) return;
    let live = true;
    QRCode.toDataURL(open.doorUrl, { margin: 1, width: 480, errorCorrectionLevel: "M" }).then((url) => {
      if (live) setQr(url);
    });
    return () => {
      live = false;
    };
  }, [open?.doorUrl]);

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
      body: JSON.stringify({ name, eventDate, questions, slots, slotCap }),
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
      body: JSON.stringify({ name, eventDate, questions, slots, slotCap }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not save.");
      return;
    }
    setSavedNote("Saved. The candidate link, manager link, and QR now use this form.");
    router.refresh();
  }

  async function removeEvent() {
    if (!open) return;
    setError("");
    setSaving(true);
    const response = await fetch(`/api/event-desk/${open.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not delete the event.");
      return;
    }
    router.push("/event-desk");
    router.refresh();
  }

  function addQuestion() {
    setQuestions([...questions, { label: "", required: false }]);
  }

  function generateSlots() {
    const start = minutesFromClock(startTime);
    const end = minutesFromClock(endTime);
    const step = Number(durationAmount);
    if (start == null || end == null || !Number.isFinite(step) || step <= 0) {
      setError("Enter a start, an end, and a length in minutes.");
      return;
    }
    if (end <= start) {
      setError("The end time has to be after the start.");
      return;
    }
    let cur = start;
    const next: string[] = [];
    while (cur + step <= end && next.length < 96) {
      next.push(`${pad(cur)} – ${pad(cur + step)}`);
      cur += step;
    }
    if (!next.length) {
      setError("That length does not fit between the start and the end.");
      return;
    }
    setError("");
    setSlots(next);
  }

  if (!open) {
    const needle = query.trim().toLowerCase();
    const visible = needle ? events.filter((event) => `${event.code} ${event.name} ${event.eventDate}`.toLowerCase().includes(needle)) : events;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink mb-1">Events</h1>
            <p className="lead">One event per client. Open an event to change its questions.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> New event
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input className="input pl-9" placeholder="Search by event…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="stamp border-brand-500 text-brand-500">All</span>
          </div>
        </div>

        <div className="card divide-y divide-line">
          {visible.length === 0 && <p className="px-4 sm:px-5 py-5 text-sm text-ink-muted">No events yet.</p>}
          {visible.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => router.push(`/event-desk?id=${event.id}`)}
              className="flex w-full flex-wrap items-center justify-between px-4 sm:px-5 py-5 hover:bg-paper transition-colors gap-3 text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{event.code}</span>
                </div>
                <p className="text-xs text-ink-muted truncate mt-0.5">
                  {event.name}
                  {event.eventDate ? ` · ${event.eventDate}` : ""}
                </p>
                <p className="text-xs text-ink-faint truncate mt-0.5">{event.booked} booked</p>
              </div>
              <div className="flex items-center gap-4 sm:gap-5 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Booked</p>
                  <p className="font-mono text-sm text-ink">{event.booked}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {creating && (
          <section className="card p-5">
            <h2 className="text-base font-semibold">New event</h2>
            <Field label="Event name">
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Harbour Bank career day" />
            </Field>
            <SetupFields
              eventDate={eventDate}
              onDate={setEventDate}
              questions={questions}
              onQuestions={setQuestions}
              onAddQuestion={addQuestion}
              slots={slots}
              onRemoveSlot={(index) => setSlots(slots.filter((_, i) => i !== index))}
              startTime={startTime}
              endTime={endTime}
              durationAmount={durationAmount}
              slotCap={slotCap}
              onStart={setStartTime}
              onEnd={setEndTime}
              onDurationAmount={setDurationAmount}
              onCap={setSlotCap}
              onGenerate={generateSlots}
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
      <h1 className="font-display text-2xl font-semibold text-ink mt-3">{open.code}</h1>
      <p className="lead">
        {open.name} · {open.bookings.length} booked · {arrived} arrived
      </p>

      <section className="card mt-5 p-5">
        <h2 className="font-display text-2xl font-semibold text-ink">Event</h2>
        <Field label="Name">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <SetupFields
          eventDate={eventDate}
          onDate={setEventDate}
          questions={questions}
          onQuestions={setQuestions}
          onAddQuestion={addQuestion}
          slots={slots}
          onRemoveSlot={(index) => setSlots(slots.filter((_, i) => i !== index))}
          startTime={startTime}
          endTime={endTime}
          durationAmount={durationAmount}
          slotCap={slotCap}
          onStart={setStartTime}
          onEnd={setEndTime}
          onDurationAmount={setDurationAmount}
          onCap={setSlotCap}
          onGenerate={generateSlots}
        />
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" disabled={saving} onClick={saveEvent}>
            Save changes
          </button>
        </div>
      </section>

      <ShareLinks event={open} senderEmail={senderEmail} />

      <section className="card mt-4 p-5">
        <h2 className="font-display text-2xl font-semibold text-ink">Links</h2>
        <div className="mt-4 space-y-4">
          <LinkRow label="Candidate link" url={open.joinUrl} copied={copied === "join"} onCopy={async () => setCopied((await copy(open.joinUrl)) ? "join" : "")} />
          <LinkRow label="Client manager link" url={open.hostUrl} copied={copied === "host"} onCopy={async () => setCopied((await copy(open.hostUrl)) ? "host" : "")} />
          <div>
            <p className="text-sm font-semibold">Door QR</p>
            <p className="mt-1 text-sm text-ink-muted">The candidate scans this. Their phone asks for the booking email, then shows the time slot.</p>
            {qr && <img src={qr} alt="Event QR code" className="mt-3 h-44 w-44 rounded-xl border border-line bg-white p-2" />}
          </div>
          {savedNote && <p className="text-sm text-emerald-700">{savedNote}</p>}
          <ConfirmFrom eventId={open.id} initial={open.confirmFrom || "contact@hrplus.info"} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
        <p className="font-semibold">Delete this event</p>
        <p className="mt-1 text-sm">
          This removes {open.code} {open.name}, including every booking. The links and QR stop working. This cannot be undone.
        </p>
        {askDelete ? (
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white" disabled={saving} onClick={removeEvent}>
              Delete forever
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAskDelete(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="mt-3 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white" onClick={() => setAskDelete(true)}>
            Delete event
          </button>
        )}
      </section>
    </div>
  );
}

function defaultShareBody(event: DeskEventView) {
  return [
    "Hello,",
    "",
    `Here are the links for ${event.name}.`,
    "",
    "Candidate link",
    "People use this form to book a name, an email, and one time slot.",
    event.joinUrl,
    "",
    "Manager link",
    "This is your board. Bookings appear as they come in, and you can move someone to another slot.",
    event.hostUrl,
    "",
    "Door QR",
    "The QR code is attached as a PDF. On the day, the candidate scans it and enters the email they booked with. That marks them as arrived.",
    "",
    "HR Plus",
  ].join("\n");
}

function ShareLinks({ event, senderEmail }: { event: DeskEventView; senderEmail: string }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState(`${event.name} — Event desk links and instructions`);
  const [body, setBody] = useState(defaultShareBody(event));
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "bad"; message: string } | null>(null);

  function addEmail(value = draft) {
    const next = value.trim().replace(/,$/, "");
    if (!next || emails.includes(next)) {
      setDraft("");
      return;
    }
    setEmails([...emails, next]);
    setDraft("");
  }

  async function send() {
    const list = draft.trim() && !emails.includes(draft.trim()) ? [...emails, draft.trim()] : emails;
    if (!list.length) {
      setStatus({ type: "bad", message: "Add at least one manager email." });
      return;
    }
    setSending(true);
    setStatus(null);
    const response = await fetch(`/api/event-desk/${event.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: list, subject, body }),
    });
    const payload = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setStatus({ type: "bad", message: payload.error || "Could not send the email." });
      return;
    }
    setEmails([]);
    setDraft("");
    setStatus({ type: "ok", message: `Email sent to ${list.join(", ")}` });
  }

  return (
    <section className="card mt-4 p-5">
      <h2 className="border-b border-line pb-3 font-display text-2xl font-semibold text-ink">Email the links to the manager</h2>
      <label className="label mt-4">Send to (manager email accounts)</label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-2 py-2 focus-within:border-brand-500 focus-within:bg-white">
        {emails.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-500">
            {email}
            <button type="button" aria-label="Remove" onClick={() => setEmails(emails.filter((item) => item !== email))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[220px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none"
          value={draft}
          placeholder={emails.length ? "Add another" : "Type a manager email and press Enter or comma"}
          onChange={(input) => setDraft(input.target.value)}
          onKeyDown={(input) => {
            if (input.key === "Enter" || input.key === ",") {
              input.preventDefault();
              addEmail();
            }
          }}
          onBlur={() => {
            if (draft.trim()) addEmail();
          }}
        />
      </div>
      <label className="label mt-4">From</label>
      <p className="rounded-xl border border-line bg-paper px-3 py-2 text-sm">{senderEmail}</p>
      <label className="label mt-4">Subject</label>
      <input className="input" value={subject} onChange={(input) => setSubject(input.target.value)} />
      <label className="label mt-4">Email content</label>
      <textarea className="input min-h-[320px]" value={body} onChange={(input) => setBody(input.target.value)} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={clsx("text-sm font-medium", status?.type === "ok" ? "text-emerald-700" : "text-danger-600")}>{status?.message}</p>
        <button type="button" className="btn-primary" disabled={sending} onClick={send}>
          {sending ? "Sending..." : "Send email"}
        </button>
      </div>
    </section>
  );
}

function ConfirmFrom({ eventId, initial }: { eventId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState("");

  async function save() {
    const next = value.trim().includes("@") ? value.trim() : "contact@hrplus.info";
    setValue(next);
    const response = await fetch(`/api/event-desk/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmFrom: next }),
    });
    setNote(response.ok ? "Saved. Candidate confirmations are sent from this address." : "Could not save that address.");
  }

  return (
    <div>
      <label className="text-sm font-semibold" htmlFor="confirm-from">Confirmation email is sent from</label>
      <input
        id="confirm-from"
        className="input mt-1.5"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
      />
      <p className="mt-1.5 text-sm text-ink-muted">After a candidate books, the confirmation is sent from this address. It starts as contact@hrplus.info.</p>
      {note && <p className="mt-1.5 text-sm text-emerald-700">{note}</p>}
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

function minutesFromClock(value: string) {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function pad(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function dateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "Choose a date";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SetupFields(props: {
  eventDate: string;
  onDate: (value: string) => void;
  questions: DeskQuestion[];
  onQuestions: (questions: DeskQuestion[]) => void;
  onAddQuestion: () => void;
  slots: string[];
  onRemoveSlot: (index: number) => void;
  startTime: string;
  endTime: string;
  durationAmount: string;
  slotCap: number;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onDurationAmount: (value: string) => void;
  onCap: (value: number) => void;
  onGenerate: () => void;
}) {
  return (
    <>
      <Field label="Event date">
        <DayField value={props.eventDate} onChange={props.onDate} />
      </Field>
      <div className="mt-5">
        <p className="text-sm font-semibold">Name and email</p>
        <p className="mt-1 text-sm text-ink-muted">These two questions are already on the form.</p>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold">Extra questions</p>
        <div className="mt-3 space-y-2">
          {props.questions.map((question, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                className="input"
                placeholder="Question"
                value={question.label}
                onChange={(event) => props.onQuestions(props.questions.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)))}
              />
              <select
                className="input !w-auto shrink-0"
                value={question.required ? "1" : "0"}
                onChange={(event) => props.onQuestions(props.questions.map((item, i) => (i === index ? { ...item, required: event.target.value === "1" } : item)))}
              >
                <option value="1">Required</option>
                <option value="0">Optional</option>
              </select>
              <button type="button" className="btn-secondary shrink-0" onClick={() => props.onQuestions(props.questions.filter((_, i) => i !== index))}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-2" onClick={props.onAddQuestion}>
          + Add custom question
        </button>
      </div>
      <div className="mt-5">
        <p className="text-sm font-semibold">Time slots</p>
        <p className="mt-1 text-sm text-ink-muted">Type a start, an end, and how many minutes each booking lasts. Seats is how many people can take the same slot.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <label className="block text-sm">
            Start
            <input className="input mt-1" inputMode="numeric" placeholder="09:30" value={props.startTime} onChange={(event) => props.onStart(event.target.value)} />
          </label>
          <label className="block text-sm">
            End
            <input className="input mt-1" inputMode="numeric" placeholder="17:00" value={props.endTime} onChange={(event) => props.onEnd(event.target.value)} />
          </label>
          <label className="block text-sm">
            Minutes each
            <input className="input mt-1" inputMode="numeric" placeholder="30" value={props.durationAmount} onChange={(event) => props.onDurationAmount(event.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <label className="block text-sm">
            Seats per slot
            <input className="input mt-1" inputMode="numeric" placeholder="1" value={props.slotCap || ""} onChange={(event) => props.onCap(Number(event.target.value.replace(/[^\d]/g, "")) || 0)} />
          </label>
        </div>
        <button type="button" className="btn-secondary mt-3" onClick={props.onGenerate}>
          Make the time slots
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {props.slots.map((slot, index) => (
            <span key={`${slot}-${index}`} className="flex items-center justify-between rounded-full border border-line px-3 py-1.5 text-sm">
              {slot}
              <button type="button" className="ml-2 text-ink-muted" onClick={() => props.onRemoveSlot(index)} aria-label="Remove time">
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function DayField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").map(Number) : null;
  const today = new Date();
  const [cursor, setCursor] = useState(() => (parsed ? new Date(parsed[0], parsed[1] - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1)));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(0), ...Array.from({ length: count }, (_, i) => i + 1)];
  return (
    <div className="relative">
      <button type="button" className="input !w-auto min-w-[220px] text-left" onClick={() => setOpen(!open)}>
        {dateLabel(value)}
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-72 rounded-2xl border border-line bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between">
            <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</button>
            <span className="text-sm font-semibold">{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
            <button type="button" className="btn-secondary" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs text-ink-faint">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const iso = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
              return (
                <button
                  key={index}
                  type="button"
                  disabled={!day}
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={clsx("h-9 rounded-lg text-sm", iso && iso === value ? "bg-brand-500 text-white" : "hover:bg-paper")}
                >
                  {day || ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
