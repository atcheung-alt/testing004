"use client";

import { useEffect, useState } from "react";

export default function DoorCheck({ token, eventName }: { token: string; eventName: string }) {
  const [title, setTitle] = useState(eventName);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ name: string; slot: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/public/desk-door/${token}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next.name) setTitle(next.name);
    }, 4000);
    return () => clearInterval(timer);
  }, [token]);

  async function arrive() {
    setError("");
    setSaving(true);
    const response = await fetch(`/api/public/desk-door/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(payload.error || "Could not confirm.");
      return;
    }
    setDone({ name: payload.name, slot: payload.slot });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="card w-full max-w-sm p-5">
        <p className="text-xs font-semibold text-brand-500">{title}</p>
        {done ? (
          <>
            <h1 className="font-display text-2xl mt-2">You’re confirmed</h1>
            <p className="mt-3 text-sm text-ink-muted">{done.name}</p>
            <p className="mt-1 text-lg font-semibold">{done.slot}</p>
            <button
              type="button"
              className="btn-secondary mt-5 w-full"
              onClick={() => {
                setDone(null);
                setEmail("");
              }}
            >
              Next person
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl mt-2">Confirm your time</h1>
            <p className="mt-2 text-sm text-ink-muted">Enter the email you used to book. We’ll show your time slot.</p>
            <label className="mt-4 block text-sm font-semibold">Email</label>
            <input className="input mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" inputMode="email" autoComplete="email" />
            {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
            <button type="button" className="btn-primary mt-4 w-full" disabled={saving} onClick={arrive}>
              Confirm
            </button>
          </>
        )}
      </div>
    </div>
  );
}
