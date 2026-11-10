"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { DeskBookingView } from "@/components/EventDesk";

type Board = {
  name: string;
  eventDate: string;
  slots: string[];
  cap: number;
  bookings: DeskBookingView[];
};

export default function HostBoard({ token, initial }: { token: string; initial: Board }) {
  const [board, setBoard] = useState(initial);
  const [slot, setSlot] = useState("All");
  const [status, setStatus] = useState<"All" | "Booked" | "Arrived">("All");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [menu, setMenu] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanEmail, setScanEmail] = useState("");

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/public/desk-host/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as Board;
      setBoard(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [token]);

  const showing = slot === "All" || board.slots.includes(slot) ? slot : "All";
  const needle = query.trim().toLowerCase();
  const rows = board.bookings.filter((booking) => {
    if (showing !== "All" && booking.slot !== showing) return false;
    if (status === "Arrived" && !booking.arrived) return false;
    if (status === "Booked" && booking.arrived) return false;
    return `${booking.name} ${booking.email}`.toLowerCase().includes(needle);
  });

  async function patch(body: Record<string, unknown>, nextSlot?: string) {
    setError("");
    const response = await fetch(`/api/public/desk-host/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not update that booking.");
      return;
    }
    setBoard(payload);
    if (nextSlot) setSlot(nextSlot);
    setMenu("");
    setScanOpen(false);
    setScanEmail("");
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">{board.name}</h1>
        <button type="button" className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-white" onClick={() => setScanOpen(!scanOpen)}>
          Door scan
        </button>
      </div>
      {scanOpen && (
        <form
          className="mt-3 flex gap-2 rounded-2xl border border-line bg-white p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            patch({ email: scanEmail });
          }}
        >
          <input className="input" type="email" value={scanEmail} placeholder="Booking email" onChange={(event) => setScanEmail(event.target.value)} required />
          <button type="submit" className="h-11 shrink-0 whitespace-nowrap rounded-xl border border-line bg-white px-4 text-sm font-semibold">Check in</button>
        </form>
      )}
      <input className="input mt-4" value={query} placeholder="Search name or email" onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-3 flex gap-2">
        {(["All", "Booked", "Arrived"] as const).map((name) => (
          <button key={name} type="button" onClick={() => setStatus(name)} className={clsx("rounded-full border px-3 py-1.5 text-sm", status === name ? "border-ink text-ink" : "border-line text-ink-muted")}>
            {name}
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-4 overflow-auto">
        {["All", ...board.slots].map((time) => (
          <button
            key={time}
            type="button"
            onClick={() => { setSlot(time); setMenu(""); }}
            className={clsx("shrink-0 border-b-2 pb-2 text-sm", showing === time ? "border-ink text-ink" : "border-transparent text-ink-muted")}
          >
            {time}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      <div className="card mt-2">
        {rows.length === 0 && <p className="p-5 text-sm text-ink-muted">No one matches.</p>}
        {rows.map((booking) => (
          <div key={booking.id} className="border-b border-line last:border-b-0">
            <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-500">
                {booking.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{booking.name}</p>
                <p className="truncate text-sm text-ink-muted">{booking.email}{showing === "All" ? ` · ${booking.slot}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold", booking.arrived ? "bg-emerald-50 text-emerald-700" : "bg-paper text-ink-muted")}>
                  {booking.arrived ? "Arrived" : "Booked"}
                </span>
                <button type="button" className="h-8 w-8 rounded-lg text-lg text-ink-muted" aria-label={`Edit ${booking.name}`} onClick={() => setMenu(menu === booking.id ? "" : booking.id)}>
                  ···
                </button>
              </div>
            </div>
            {menu === booking.id && (
              <div className="mx-4 mb-3 rounded-xl border border-line bg-white p-1.5">
                <select className="input" value={booking.slot} onChange={(event) => patch({ bookingId: booking.id, slot: event.target.value }, event.target.value)}>
                  {board.slots.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <button type="button" className="mt-1 block w-full rounded-lg px-2.5 py-2 text-left text-sm text-rose-700" onClick={() => { setConfirmId(booking.id); setMenu(""); }}>
                  Delete
                </button>
              </div>
            )}
            {confirmId === booking.id && (
              <div className="mx-4 mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <p className="font-semibold">Delete {booking.name}?</p>
                <p className="mt-1">This removes their booking. This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => { setConfirmId(""); patch({ bookingId: booking.id, remove: true }); }}>
                    Delete
                  </button>
                  <button type="button" className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold" onClick={() => setConfirmId("")}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
