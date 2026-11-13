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
  company,
  title,
  email,
  annualLeaveLeft,
  startDate,
  initial,
}: {
  token: string;
  employeeName: string;
  company: string;
  title: string;
  email: string;
  annualLeaveLeft: number;
  startDate: string;
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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

  const needle = query.trim().toLowerCase();
  const visible = items
    .filter((item) => {
      const label = LABELS[item.leaveType] || item.leaveType;
      if (needle && !`${label} ${item.reason}`.toLowerCase().includes(needle)) return false;
      const start = item.startDate.slice(0, 10);
      const end = item.endDate.slice(0, 10);
      if (fromDate && end < fromDate) return false;
      if (toDate && start > toDate) return false;
      return true;
    })
    .sort((a, b) => {
      const rank = (status: string) => (status === "PENDING" ? 0 : status === "APPROVED" ? 1 : 2);
      return rank(a.status) - rank(b.status) || b.startDate.localeCompare(a.startDate);
    });

  return (
    <div className="outside-leave-page">
    <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col gap-4">
      <h1 className="font-display text-3xl font-medium">Leave to review</h1>
      <p className="text-sm text-ink-muted">For the line manager of {employeeName}</p>
      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Employee</p><p className="font-semibold">{employeeName}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Company</p><p className="font-semibold">{company || "—"}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Position</p><p className="font-semibold">{title || "—"}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Email</p><p className="font-semibold">{email || "—"}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Annual leave left</p><p className="font-semibold">{annualLeaveLeft} days</p></div>
        <div><p className="text-xs uppercase tracking-wide text-ink-faint">Start date</p><p className="font-semibold">{startDate}</p></div>
      </div>
      {items.length > 0 && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr] gap-2">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search type or reason" />
          <input className="input" type="date" aria-label="From date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="input" type="date" aria-label="To date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      )}
      {error && <p className="text-sm text-danger-600">{error}</p>}
      {items.length === 0 && <div className="card p-5 text-sm text-ink-muted">No leave request yet.</div>}
      {items.length > 0 && visible.length === 0 && <div className="card p-5 text-sm text-ink-muted">No request matches that search.</div>}
      {visible.map((item) => (
        <div key={item.id} className="card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{LABELS[item.leaveType] || item.leaveType}</p>
              <p className="text-sm text-ink-muted">
                {formatDate(item.startDate)} – {formatDate(item.endDate)}
              </p>
            </div>
            <span
              className={`text-xs rounded-full px-2.5 py-1 border ${
                item.status === "APPROVED"
                  ? "text-emerald-300 border-emerald-700"
                  : item.status === "REJECTED"
                    ? "text-rose-300 border-rose-800"
                    : "text-amber-200 border-amber-700"
              }`}
            >
              {item.status === "PENDING" ? "Waiting" : item.status === "APPROVED" ? "Approved" : "Rejected"}
            </span>
          </div>
          <p className="text-sm">{item.reason || "No reason given."}</p>
          <p className="text-sm text-ink-muted">{item.documentName ? `Document: ${item.documentName}` : "No document attached."}</p>
          {item.status === "REJECTED" && item.decidedNote && (
            <p className="text-sm text-ink-muted">Rejection reason: {item.decidedNote}</p>
          )}
          {item.status === "PENDING" && (
            <>
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
            </>
          )}
        </div>
      ))}
    </div>
    </div>
  );
}
