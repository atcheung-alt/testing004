"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";

export default function OutsideLeaveCard({
  employeeId,
  defaultColleagueEmail,
  defaultManagerEmail,
}: {
  employeeId: string;
  defaultColleagueEmail: string;
  defaultManagerEmail: string;
}) {
  const [colleagueEmail, setColleagueEmail] = useState(defaultColleagueEmail);
  const [lineManagerEmail, setLineManagerEmail] = useState(defaultManagerEmail);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/outside-leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colleagueEmail, lineManagerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The emails could not be sent.");
      setMessage("Sent. The colleague can request leave. The line manager can approve or reject it.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Leave links</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl bg-paper px-3 py-2.5">
          <p className="font-semibold">1. Colleague</p>
          <p className="text-sm text-ink-muted">They request annual leave, sick leave, or no-pay leave.</p>
        </div>
        <div className="rounded-xl bg-paper px-3 py-2.5">
          <p className="font-semibold">2. Line manager</p>
          <p className="text-sm text-ink-muted">They approve the request, or reject it with a reason.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Colleague email</label>
          <input className="input" value={colleagueEmail} onChange={(e) => setColleagueEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Line manager email</label>
          <input className="input" value={lineManagerEmail} onChange={(e) => setLineManagerEmail(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <button type="button" className="btn-primary self-start" disabled={sending} onClick={send}>
        {sending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
        Email both links
      </button>
    </div>
  );
}
