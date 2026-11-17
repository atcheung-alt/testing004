"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";

export default function OutsideLeaveCard({
  employeeId,
  defaultColleagueEmail,
  defaultManagerName,
  defaultManagerEmail,
  alreadySent = false,
}: {
  employeeId: string;
  defaultColleagueEmail: string;
  defaultManagerName: string;
  defaultManagerEmail: string;
  alreadySent?: boolean;
}) {
  const [colleagueEmail, setColleagueEmail] = useState(defaultColleagueEmail);
  const [lineManagerName, setLineManagerName] = useState(defaultManagerName);
  const [lineManagerEmail, setLineManagerEmail] = useState(defaultManagerEmail);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(alreadySent ? "Already sent. The colleague and the line manager have their links." : null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const colleague = colleagueEmail.trim();
    const manager = lineManagerName.trim();
    const managerEmail = lineManagerEmail.trim();
    if (!colleague.includes("@") || !manager || !managerEmail.includes("@")) return;
    const handle = setTimeout(() => {
      fetch(`/api/employees/${employeeId}/outside-leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colleagueEmail: colleague, lineManagerName: manager, lineManagerEmail: managerEmail, saveOnly: true }),
      }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(handle);
  }, [colleagueEmail, lineManagerName, lineManagerEmail, employeeId]);

  async function send() {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}/outside-leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colleagueEmail, lineManagerName, lineManagerEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The emails could not be sent.");
      setMessage("Already sent. The colleague and the line manager have their links.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Send the leave links</h2>
        <p className="text-sm text-ink-muted mt-1">One email to the colleague, one email to the manager.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Colleague email</label>
          <input className="input" value={colleagueEmail} onChange={(e) => setColleagueEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Line manager name</label>
          <input className="input" value={lineManagerName} onChange={(e) => setLineManagerName(e.target.value)} />
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
