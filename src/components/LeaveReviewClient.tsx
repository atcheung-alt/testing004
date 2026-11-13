"use client";

import { useState } from "react";
import { formatDate } from "@/lib/calculations";

type Item = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  documentName: string | null;
  status: string;
  decidedNote: string | null;
};

const LABELS: Record<string, string> = {
  ANNUAL: "Annual leave",
  SICK: "Sick leave",
  NO_PAY: "No-pay leave",
};

export default function LeaveReviewClient({
  token,
  employeeName,
  initial,
}: {
  token: string;
  employeeName: string;
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(id: string, action: "approve" | "reject") {
    if (action === "reject" && !reason.trim()) {
      setError("Write a reason before rejecting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/leave/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That update did not save.");
      setItems(data.requests);
      setRejecting(null);
      setReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const pending = items.filter((item) => item.status === "PENDING");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Leave to review</h1>
      <p className="text-sm text-ink-muted">Line manager for {employeeName}</p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {pending.length === 0 && <div className="card p-5 text-sm text-ink-muted">No request waiting.</div>}
      {pending.map((item) => (
        <div key={item.id} className="card p-5 flex flex-col gap-3">
          <div>
            <p className="font-semibold">{LABELS[item.leaveType] || item.leaveType}</p>
            <p className="text-sm text-ink-muted">
              {formatDate(item.startDate)} – {formatDate(item.endDate)}
            </p>
          </div>
          <p className="text-sm">{item.reason || "No reason given."}</p>
          <p className="text-sm text-ink-muted">{item.documentName ? `Document: ${item.documentName}` : "No document attached."}</p>
          <div className="flex gap-2">
            <button className="btn-primary" type="button" disabled={busy} onClick={() => decide(item.id, "approve")}>
              Approve
            </button>
            <button className="btn-secondary" type="button" disabled={busy} onClick={() => setRejecting(item.id)}>
              Reject
            </button>
          </div>
          {rejecting === item.id && (
            <div className="flex flex-col gap-2">
              <label className="label">Reason for rejection</label>
              <textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="btn-primary self-start" type="button" disabled={busy} onClick={() => decide(item.id, "reject")}>
                Send rejection
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
