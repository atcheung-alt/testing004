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
  const [slot, setSlot] = useState(initial.slots[0] || "");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/public/desk-host/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as Board;
      setBoard(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [token]);

  const showing = slot && board.slots.includes(slot) ? slot : board.slots[0] || "";
  const rows = board.bookings.filter((booking) => booking.slot === showing);
  const arrived = board.bookings.filter((booking) => booking.arrived).length;

  async function move(bookingId: string, nextSlot: string) {
    setError("");
    const response = await fetch(`/api/public/desk-host/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, slot: nextSlot }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not move that person.");
      return;
    }
    setBoard(payload);
    setSlot(nextSlot);
  }

  return (
    <div>
      <p className="text-xs font-semibold text-brand-500">Client manager</p>
      <h1 className="font-display text-2xl mt-2">{board.name}</h1>
      <p className="lead mt-2">
        {board.eventDate ? `${board.eventDate} · ` : ""}
        {board.bookings.length} booked · {arrived} arrived. This page updates when someone books or scans the QR.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {board.slots.map((time) => {
          const count = board.bookings.filter((booking) => booking.slot === time).length;
          return (
            <button
              key={time}
              type="button"
              onClick={() => setSlot(time)}
              className={clsx("stamp", showing === time ? "border-brand-500 text-brand-500" : "border-line text-ink-muted")}
            >
              {time} · {count}/{board.cap}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      <div className="card mt-4 divide-y divide-line">
        {rows.length === 0 && <p className="p-5 text-sm text-ink-muted">No one in this slot yet.</p>}
        {rows.map((booking) => (
          <div key={booking.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{booking.name}</p>
              <p className="truncate text-sm text-ink-muted">
                {booking.email}
                {Object.entries(booking.answers)
                  .filter(([, value]) => value)
                  .map(([key, value]) => ` · ${key}: ${value}`)
                  .join("")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={clsx("stamp", booking.arrived ? "border-emerald-600 text-emerald-700" : "border-line text-ink-muted")}>
                {booking.arrived ? "Arrived" : "Booked"}
              </span>
              <select className="input !w-auto" value={booking.slot} onChange={(event) => move(booking.id, event.target.value)}>
                {board.slots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
