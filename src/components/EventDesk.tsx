"use client";

import { useState } from "react";
import clsx from "clsx";

type Slot = { id: string; time: string; cap: number };
type Person = { id: string; name: string; email: string; slot: string; arrived: boolean; code: string };

const SLOTS: Slot[] = [
  { id: "a", time: "09:30 – 10:30", cap: 200 },
  { id: "b", time: "10:30 – 11:30", cap: 200 },
  { id: "c", time: "14:00 – 15:00", cap: 200 },
  { id: "d", time: "15:00 – 16:00", cap: 200 },
];

const SEED: Person[] = [
  ["Chan Tai Man", "a"],
  ["Lee Mei", "a"],
  ["Wong Ka Ho", "b"],
  ["Cheung Yee", "b"],
  ["Ng Hoi Lam", "c"],
  ["Lau Sze", "c"],
  ["Ho Man Kit", "d"],
  ["Tam Wing", "a"],
].map(([name, slot], index) => ({
  id: `p${index}`,
  name,
  email: `${name.toLowerCase().replace(/ /g, ".")}@example.com`,
  slot,
  arrived: index % 5 === 0,
  code: `HB-${String(index + 1).padStart(4, "0")}`,
}));

export default function EventDesk() {
  const [view, setView] = useState<"book" | "qr" | "desk">("book");
  const [people, setPeople] = useState<Person[]>(SEED);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [mine, setMine] = useState<Person | null>(null);
  const [deskSlot, setDeskSlot] = useState("a");

  function taken(id: string) {
    return people.filter((person) => person.slot === id).length;
  }
  function left(id: string) {
    return (SLOTS.find((item) => item.id === id)?.cap || 0) - taken(id);
  }

  function book() {
    if (!name.trim() || !email.includes("@") || !slot) {
      setError("Enter a name, an email, and a time.");
      return;
    }
    if (left(slot) <= 0) {
      setError("That time is full.");
      return;
    }
    const person: Person = {
      id: `n${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      slot,
      arrived: false,
      code: `HB-${String(people.length + 1).padStart(4, "0")}`,
    };
    setPeople((rows) => [...rows, person]);
    setMine(person);
    setName("");
    setEmail("");
    setSlot("");
    setError("");
  }

  function arrive() {
    const who = mine || people[0];
    if (!who) return;
    setPeople((rows) => rows.map((person) => (person.id === who.id ? { ...person, arrived: true } : person)));
    if (mine) setMine({ ...mine, arrived: true });
  }

  function move(id: string, next: string) {
    const person = people.find((row) => row.id === id);
    if (!person || person.slot === next) return;
    if (left(next) <= 0) return;
    setPeople((rows) => rows.map((row) => (row.id === id ? { ...row, slot: next } : row)));
    setDeskSlot(next);
  }

  const who = mine || people[0];
  const whoSlot = SLOTS.find((item) => item.id === who?.slot);
  const arrivedCount = people.filter((person) => person.arrived).length;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["book", "1 · Candidate books"],
            ["qr", "2 · Scan QR on the day"],
            ["desk", "3 · Client checks slots"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={clsx(
              "rounded-full border px-3.5 py-2 text-sm",
              view === id ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-white text-ink-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "book" && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-brand-500">Harbour Bank · Career day</p>
          {mine ? (
            <div className="card mt-4 p-8 text-center">
              <h1 className="font-display text-2xl">You’re booked</h1>
              <p className="lead mt-2">
                {mine.name}
                <br />
                {SLOTS.find((item) => item.id === mine.slot)?.time}
              </p>
              <p className="mt-3 font-mono text-xl tracking-widest">{mine.code}</p>
              <p className="mt-3 text-sm text-ink-muted">
                Bring this name to the door. On the day, scan the event QR code to confirm you have arrived.
              </p>
              <button type="button" className="btn-primary mt-5" onClick={() => setMine(null)}>
                Book another person
              </button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl mt-2">Pick a time</h1>
              <p className="lead mt-2">
                One form. Name, email, and a time. This day can hold 800 people. {people.length} booked so far.
              </p>
              <div className="card mt-4 p-5">
                <label className="block text-sm font-semibold">Name</label>
                <input className="input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} placeholder="Chan Tai Man" />
                <label className="mt-3 block text-sm font-semibold">Email</label>
                <input className="input mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tai.man@example.com" />
                <p className="mt-3 text-sm font-semibold">Time slot</p>
                <div className="mt-2 space-y-2">
                  {SLOTS.map((item) => {
                    const seats = left(item.id);
                    const full = seats <= 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={full}
                        onClick={() => setSlot(item.id)}
                        className={clsx(
                          "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left",
                          slot === item.id ? "border-brand-500 bg-brand-50" : "border-line",
                          full && "opacity-45"
                        )}
                      >
                        <span className="font-semibold">{item.time}</span>
                        <span className="text-sm text-ink-muted">{full ? "Full" : `${seats} seats left`}</span>
                      </button>
                    );
                  })}
                </div>
                {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
                <button type="button" className="btn-primary mt-4 w-full" onClick={book}>
                  Confirm booking
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === "qr" && who && whoSlot && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-brand-500">At the venue</p>
          <h1 className="font-display text-2xl mt-2">Scan to confirm</h1>
          <p className="lead mt-2">One QR code for the event. The candidate scans it and confirms the booking they already made.</p>
          <div className="card mt-4 p-8 text-center">
            <div className="mx-auto grid h-40 w-40 grid-cols-5 grid-rows-5 overflow-hidden rounded-2xl border border-line">
              {Array.from({ length: 25 }, (_, index) => (
                <span key={index} className={index % 2 === 0 || index % 7 === 0 ? "bg-ink" : "bg-white"} />
              ))}
            </div>
            <p className="mt-4 font-semibold">{who.name}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {whoSlot.time}
              {who.arrived ? " · Already confirmed" : ""}
            </p>
            <button type="button" className="btn-primary mt-4" disabled={who.arrived} onClick={arrive}>
              {who.arrived ? "Arrived" : "I have arrived"}
            </button>
          </div>
        </div>
      )}

      {view === "desk" && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-brand-500">For the client company</p>
          <h1 className="font-display text-2xl mt-2">Harbour Bank career day</h1>
          <p className="lead mt-2">
            {people.length} booked · {arrivedCount} arrived. Open a time, see who is coming, and move someone if a slot is too full.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SLOTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDeskSlot(item.id)}
                className={clsx("stamp", deskSlot === item.id ? "border-brand-500 text-brand-500" : "border-line text-ink-muted")}
              >
                {item.time} · {taken(item.id)}/{item.cap}
              </button>
            ))}
          </div>
          <div className="card mt-4 divide-y divide-line">
            {people.filter((person) => person.slot === deskSlot).length === 0 && (
              <p className="p-5 text-sm text-ink-muted">No one in this slot yet.</p>
            )}
            {people
              .filter((person) => person.slot === deskSlot)
              .map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{person.name}</p>
                    <p className="truncate text-sm text-ink-muted">{person.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={clsx("stamp", person.arrived ? "border-emerald-600 text-emerald-700" : "border-line text-ink-muted")}>
                      {person.arrived ? "Arrived" : "Booked"}
                    </span>
                    <select className="input !w-auto" value={person.slot} onChange={(event) => move(person.id, event.target.value)}>
                      {SLOTS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
