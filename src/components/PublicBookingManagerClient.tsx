"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Portal from "@/components/Portal";
import PublicCompanyHeader, { type PublicCompany } from "@/components/PublicCompanyHeader";
import CopySigningLinkButton from "@/components/CopySigningLinkButton";
import BookingTimeField from "@/components/BookingTimeField";
import {
  DEFAULT_SLOT_DURATION_MINUTES,
  MAX_SLOT_QUOTA,
  SLOT_DURATION_MAX_MINUTES,
  SLOT_DURATION_MIN_MINUTES,
  SLOT_DURATION_STEP_MINUTES,
  formatDateLabel,
  formatDurationLabel,
  formatTimeRangeLabel,
  readJsonOrThrow,
  type BookingStatus,
} from "@/lib/bookingFormat";
import { useT } from "@/lib/i18n/client";

export type ManagedEventInfo = {
  id: string;
  name: string;
  companyName: string;
  description: string;
  startDate: string; // ISO
  endDate: string; // ISO
  active: boolean;
};

export type ManagedSlotItem = {
  id: string;
  date: string; // ISO
  startTime: string;
  durationMins: number;
  quota: number;
  taken: number;
  available: number;
};

export type ManagedBookingItem = {
  id: string;
  slotId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string;
  status: BookingStatus;
  decidedNote: string | null;
  slotDate: string; // ISO
  slotStartTime: string;
  slotDurationMins: number;
};

function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function sortSlots(slots: ManagedSlotItem[]): ManagedSlotItem[] {
  return [...slots].sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
}

const STATUS_BADGE_STYLES: Record<BookingStatus, string> = {
  PENDING: "border-amber-500 text-amber-600 bg-amber-50",
  CONFIRMED: "border-brand-500 text-brand-600 bg-brand-50",
  CANCELLED: "border-ink-faint text-ink-faint",
  REJECTED: "border-ink-faint text-ink-faint",
};

function BookingDetail({
  booking,
  onCancel,
  onDelete,
}: {
  booking: ManagedBookingItem;
  onCancel: (decidedNote: string | null) => Promise<string | null>;
  onDelete: () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const warning = await onCancel(note.trim() || null);
      if (warning) setError(warning);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        t(
          "Permanently delete this booking? This cannot be undone, and — unlike Cancel — the client will NOT be notified. Only do this for test or fake bookings."
        )
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink truncate">{booking.clientName}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx("stamp", STATUS_BADGE_STYLES[booking.status])}>{t(booking.status)}</span>
          {booking.status !== "CONFIRMED" && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              title={t("Delete booking — no client notification, for test/fake bookings only")}
              aria-label={t("Delete booking")}
              className="text-ink-faint hover:text-danger-600 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line p-3 text-sm flex flex-col gap-1">
        <p className="text-ink">
          {t("{date} at {time}", {
            date: formatDateLabel(booking.slotDate),
            time: formatTimeRangeLabel(booking.slotStartTime, booking.slotDurationMins),
          })}
        </p>
        <p className="text-ink-muted">{t("{count} minutes", { count: booking.slotDurationMins })}</p>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        {booking.clientPhone && (
          <a href={`tel:${booking.clientPhone}`} className="flex items-center gap-1.5 text-ink-muted hover:text-brand-600 hover:underline">
            <Phone size={13} /> {booking.clientPhone}
          </a>
        )}
        {booking.clientEmail && (
          <a href={`mailto:${booking.clientEmail}`} className="flex items-center gap-1.5 text-ink-muted hover:text-brand-600 hover:underline">
            <Mail size={13} /> {booking.clientEmail}
          </a>
        )}
      </div>

      {booking.notes && (
        <div>
          <p className="label mb-1">{t("Notes from client")}</p>
          <p className="text-sm text-ink-muted">{booking.notes}</p>
        </div>
      )}

      {booking.status === "CANCELLED" && booking.decidedNote && (
        <div>
          <p className="label mb-1">{t("Cancellation note")}</p>
          <p className="text-sm text-ink-muted">{booking.decidedNote}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </div>
      )}

      {booking.status === "CONFIRMED" && (
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          {showCancelForm ? (
            <>
              <textarea
                className="input min-h-[70px] text-sm"
                placeholder={t("Optional note (e.g. why it's being cancelled)")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleCancel} disabled={busy} className="btn-secondary">
                  {busy && <Loader2 size={14} className="animate-spin" />} {t("Confirm cancel")}
                </button>
                <button type="button" onClick={() => setShowCancelForm(false)} disabled={busy} className="text-sm text-ink-muted hover:text-ink">
                  {t("Never mind")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowCancelForm(true)} disabled={busy} className="btn-secondary">
                <Ban size={15} /> {t("Cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PublicBookingManagerClient({
  token,
  event: initialEvent,
  slots: initialSlots,
  bookings: initialBookings,
  bookingUrl,
  company,
}: {
  token: string;
  event: ManagedEventInfo;
  slots: ManagedSlotItem[];
  bookings: ManagedBookingItem[];
  bookingUrl: string;
  company: PublicCompany;
}) {
  const t = useT();
  const [event, setEvent] = useState(initialEvent);
  const [slots, setSlots] = useState(() => sortSlots(initialSlots));
  const [bookings, setBookings] = useState(initialBookings);
  const [modalBooking, setModalBooking] = useState<ManagedBookingItem | null>(null);

  const apiBase = `/api/public/bookings/manage/${token}`;

  // --- Event header: inline edit only (no hide/show, no delete — staff only) ---
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(event.name);
  const [editCompanyName, setEditCompanyName] = useState(event.companyName);
  const [editDescription, setEditDescription] = useState(event.description);
  const [editStartDate, setEditStartDate] = useState(isoDateOnly(event.startDate));
  const [editEndDate, setEditEndDate] = useState(isoDateOnly(event.endDate));
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEditing() {
    setEditName(event.name);
    setEditCompanyName(event.companyName);
    setEditDescription(event.description);
    setEditStartDate(isoDateOnly(event.startDate));
    setEditEndDate(isoDateOnly(event.endDate));
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          companyName: editCompanyName,
          description: editDescription,
          startDate: editStartDate,
          endDate: editEndDate,
        }),
      });
      const data = await readJsonOrThrow(res, "Could not save changes.");
      setEvent((prev) => ({
        ...prev,
        name: data.name,
        companyName: data.companyName,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
      }));
      setEditing(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  // --- Slot creation ---------------------------------------------------------
  const [addDate, setAddDate] = useState(isoDateOnly(event.startDate));
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [addStartTime, setAddStartTime] = useState("09:00");
  const [addEndTime, setAddEndTime] = useState("17:00");
  const [addDuration, setAddDuration] = useState(DEFAULT_SLOT_DURATION_MINUTES);
  const [addQuota, setAddQuota] = useState(1);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function submitAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddError(null);
    try {
      const body =
        addMode === "single"
          ? { mode: "single", date: addDate, startTime: addStartTime, durationMins: addDuration, quota: addQuota }
          : { mode: "bulk", date: addDate, startTime: addStartTime, endTime: addEndTime, durationMins: addDuration, quota: addQuota };
      const res = await fetch(`${apiBase}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrThrow(res, "Could not add the slot(s).");
      const created: { id: string; date: string; startTime: string; durationMins: number; quota: number }[] =
        addMode === "single" ? [data] : data.slots;
      setSlots((prev) =>
        sortSlots([
          ...prev,
          ...created.map((s) => ({ id: s.id, date: s.date, startTime: s.startTime, durationMins: s.durationMins, quota: s.quota, taken: 0, available: s.quota })),
        ])
      );
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  const [slotAction, setSlotAction] = useState<Record<string, { busy: boolean; error: string | null }>>({});

  async function removeSlot(id: string) {
    if (!window.confirm(t("Remove this time slot? Only possible if no one has ever booked it."))) return;
    setSlotAction((prev) => ({ ...prev, [id]: { busy: true, error: null } }));
    try {
      const res = await fetch(`${apiBase}/slots/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not remove this slot.");
      setSlots((prev) => prev.filter((s) => s.id !== id));
      setSlotAction((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: any) {
      setSlotAction((prev) => ({ ...prev, [id]: { busy: false, error: err.message } }));
    }
  }

  const slotGroups = useMemo(() => {
    const map = new Map<string, ManagedSlotItem[]>();
    for (const s of slots) {
      const key = isoDateOnly(s.date);
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [slots]);

  // --- Bookings: cancel / delete ----------------------------------------------
  async function handleCancel(id: string, decidedNote: string | null): Promise<string | null> {
    const res = await fetch(`${apiBase}/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decidedNote }),
    });
    const data = await readJsonOrThrow(res, "Could not save that change.");
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: data.status, decidedNote: data.decidedNote } : b)));
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== data.slotId) return s;
        const taken = Math.max(0, s.taken - 1);
        return { ...s, taken, available: Math.max(0, s.quota - taken) };
      })
    );
    setModalBooking((m) => (m && m.id === id ? { ...m, status: data.status, decidedNote: data.decidedNote } : m));
    return data.emailWarning || null;
  }

  async function handleDelete(id: string) {
    const res = await fetch(`${apiBase}/bookings/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not delete this booking.");
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setModalBooking(null);
  }

  const confirmedBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "CONFIRMED")
        .sort((a, b) => (a.slotDate === b.slotDate ? a.slotStartTime.localeCompare(b.slotStartTime) : a.slotDate.localeCompare(b.slotDate))),
    [bookings]
  );
  const cancelledBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "CANCELLED")
        .sort((a, b) => (a.slotDate === b.slotDate ? b.slotStartTime.localeCompare(a.slotStartTime) : b.slotDate.localeCompare(a.slotDate))),
    [bookings]
  );
  const [showCancelled, setShowCancelled] = useState(false);

  function BookingRow({ b }: { b: ManagedBookingItem }) {
    const t = useT();
    return (
      <button
        type="button"
        onClick={() => setModalBooking(b)}
        className="flex items-center justify-between gap-3 py-2.5 text-left hover:bg-paper -mx-1 px-1 rounded-lg transition-colors w-full"
      >
        <p className="text-sm font-medium text-ink truncate">
          {formatDateLabel(b.slotDate)} · {formatTimeRangeLabel(b.slotStartTime, b.slotDurationMins)} · {b.clientName}
        </p>
        <span className={clsx("stamp shrink-0", STATUS_BADGE_STYLES[b.status])}>{t(b.status)}</span>
      </button>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
      <PublicCompanyHeader company={company} />

      <div className="rounded-xl border border-brand-500/30 bg-brand-50 text-brand-700 text-sm px-4 py-2.5">
        {t(
          "You're managing this event via a shared link — anyone with this URL can make the same changes. You can edit this event's details and time slots, and cancel or delete its bookings, but hiding or deleting the whole event needs staff access."
        )}
      </div>

      {/* Header */}
      <div className="card p-5 sm:p-6">
        {editing ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">{t("Event name *")}</label>
              <input type="text" className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t("Company *")}</label>
              <input type="text" className="input" value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} required />
            </div>
            <div>
              <label className="label">{t("Description")}</label>
              <textarea className="input min-h-[70px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">{t("Start date *")}</label>
                <input type="date" className="input" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="label">{t("End date *")}</label>
                <input
                  type="date"
                  className="input"
                  value={editEndDate}
                  min={editStartDate || undefined}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            {editError && (
              <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{t(editError)}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} disabled={editBusy} className="btn-primary">
                {editBusy && <Loader2 size={14} className="animate-spin" />} {t("Save")}
              </button>
              <button type="button" onClick={() => setEditing(false)} disabled={editBusy} className="btn-secondary">
                {t("Cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-semibold text-ink">{event.name}</h1>
                <span className={clsx("stamp", event.active ? "border-brand-500 text-brand-500 bg-brand-50" : "border-ink-faint text-ink-faint")}>
                  {event.active ? t("Active") : t("Hidden")}
                </span>
              </div>
              <p className="text-sm text-ink-muted mt-1">{event.companyName}</p>
              {event.description && (
                <p className="text-sm text-ink-muted mt-1 whitespace-pre-wrap">{event.description}</p>
              )}
              <p className="text-sm text-ink-muted mt-1">
                {formatDateLabel(event.startDate)}
                {isoDateOnly(event.startDate) !== isoDateOnly(event.endDate) && ` – ${formatDateLabel(event.endDate)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <CopySigningLinkButton url={bookingUrl} label={t("Copy booking link")} title={t("Copy this event's public booking link to send to clients")} />
              <button type="button" onClick={startEditing} className="btn-secondary">
                <Pencil size={14} /> {t("Edit")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slots */}
      <div className="card p-5 sm:p-6 flex flex-col gap-5">
        <h2 className="font-display text-lg font-semibold text-ink">{t("Time slots")}</h2>

        <form onSubmit={submitAddSlot} className="rounded-xl border border-line p-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAddMode("single")}
              className={clsx(
                "rounded-md border px-3 py-3 text-left",
                addMode === "single" ? "border-brand-600 bg-brand-50" : "border-line bg-surface hover:bg-paper"
              )}
            >
              <span className="block text-sm font-medium text-ink">{t("One time")}</span>
              <span className="block text-xs text-ink-muted mt-0.5">{t("Add a single appointment on this day.")}</span>
            </button>
            <button
              type="button"
              onClick={() => setAddMode("bulk")}
              className={clsx(
                "rounded-md border px-3 py-3 text-left",
                addMode === "bulk" ? "border-brand-600 bg-brand-50" : "border-line bg-surface hover:bg-paper"
              )}
            >
              <span className="block text-sm font-medium text-ink">{t("Repeat until")}</span>
              <span className="block text-xs text-ink-muted mt-0.5">
                {t("Add the same length of appointment from the start time until the end time.")}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="max-w-xs">
              <label className="label">{t("Date")}</label>
              <input
                type="date"
                className="input"
                value={addDate}
                min={isoDateOnly(event.startDate)}
                max={isoDateOnly(event.endDate)}
                onChange={(e) => setAddDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Start time")}</label>
              <BookingTimeField value={addStartTime} onChange={setAddStartTime} />
            </div>
            {addMode === "bulk" && (
              <div>
                <label className="label">{t("End time")}</label>
                <BookingTimeField value={addEndTime} onChange={setAddEndTime} />
              </div>
            )}
          </div>

          <div className="max-w-[220px]">
            <label className="label">{t("How long is each appointment?")}</label>
            <input
              type="number"
              className="input"
              min={SLOT_DURATION_MIN_MINUTES}
              max={SLOT_DURATION_MAX_MINUTES}
              step={SLOT_DURATION_STEP_MINUTES}
              value={addDuration}
              onChange={(e) => setAddDuration(Math.min(SLOT_DURATION_MAX_MINUTES, Math.max(SLOT_DURATION_MIN_MINUTES, Number(e.target.value) || 0)))}
              required
            />
            <p className="mt-1 text-xs text-ink-faint">{formatDurationLabel(addDuration)}</p>
          </div>

          <div className="max-w-xs">
            <label className="label">{t("How many people can book each time?")}</label>
            <input
              type="number"
              className="input"
              min={1}
              max={MAX_SLOT_QUOTA}
              value={addQuota}
              onChange={(e) => setAddQuota(Math.max(1, Number(e.target.value) || 1))}
              required
            />
          </div>

          {addError && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{t(addError)}</span>
            </div>
          )}

          <button type="submit" disabled={addBusy} className="btn-primary self-start">
            {addBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {addMode === "single" ? t("Add this time") : t("Add these times")}
          </button>
        </form>

        {slotGroups.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No time slots yet — add one above to start taking bookings.")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {slotGroups.map(([dateStr, group]) => (
              <div key={dateStr}>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">{formatDateLabel(dateStr)}</p>
                <div className="flex flex-col divide-y divide-line rounded-xl border border-line overflow-hidden">
                  {group.map((s) => {
                    const action = slotAction[s.id];
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{formatTimeRangeLabel(s.startTime, s.durationMins)}</p>
                          <p className="text-xs text-ink-muted">
                            {t("{taken}/{quota} booked", { taken: s.taken, quota: s.quota })}
                            {s.available <= 0 ? t(" · Full") : ""}
                          </p>
                          {action?.error && <p className="text-xs text-danger-600 mt-0.5">{t(action.error)}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(s.id)}
                          disabled={action?.busy}
                          title={t("Remove slot")}
                          aria-label={t("Remove slot")}
                          className="text-ink-faint hover:text-danger-600 transition-colors disabled:opacity-50 shrink-0"
                        >
                          {action?.busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmed bookings */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Confirmed bookings")}</h2>
          {confirmedBookings.length > 0 && <span className="stamp border-brand-500 text-brand-600 bg-brand-50">{confirmedBookings.length}</span>}
        </div>
        {confirmedBookings.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("Nothing confirmed yet.")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {confirmedBookings.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>

      {/* Cancelled */}
      <div className="card p-4 sm:p-5">
        <button type="button" onClick={() => setShowCancelled((v) => !v)} className="flex items-center justify-between gap-3 w-full text-left">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Cancelled bookings")}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {cancelledBookings.length > 0 && <span className="stamp border-ink-faint text-ink-faint">{cancelledBookings.length}</span>}
            {showCancelled ? <ChevronUp size={16} className="text-ink-faint" /> : <ChevronDown size={16} className="text-ink-faint" />}
          </div>
        </button>
        {showCancelled &&
          (cancelledBookings.length === 0 ? (
            <p className="text-sm text-ink-muted mt-3">{t("No cancelled bookings.")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-line mt-3">
              {cancelledBookings.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </div>
          ))}
      </div>

      {modalBooking && (
        <Portal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm px-4 animate-fade-in"
            onClick={() => setModalBooking(null)}
          >
            <div className="card p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold text-ink">{t("Booking")}</h2>
                <button type="button" onClick={() => setModalBooking(null)} className="text-ink-faint hover:text-ink transition-colors" aria-label={t("Close")}>
                  <X size={18} />
                </button>
              </div>
              <BookingDetail
                booking={modalBooking}
                onCancel={(decidedNote) => handleCancel(modalBooking.id, decidedNote)}
                onDelete={() => handleDelete(modalBooking.id)}
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
