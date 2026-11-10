"use client";

import { useState } from "react";

export default function DoorCheck({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [saving, setSaving] = useState(false);

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
    setDone(`${payload.name} · ${payload.slot}`);
  }

  if (done) {
    return (
      <div className="mt-4">
        <p className="font-semibold">Arrived</p>
        <p className="mt-1 text-sm text-ink-muted">{done}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => { setDone(""); setEmail(""); }}>
          Next person
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 text-left">
      <label className="block text-sm font-semibold">Email on the booking</label>
      <input className="input mt-1.5" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@email.com" />
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      <button type="button" className="btn-primary mt-4 w-full" disabled={saving} onClick={arrive}>
        I have arrived
      </button>
    </div>
  );
}
