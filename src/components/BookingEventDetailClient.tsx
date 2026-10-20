"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AlertCircle,
  Ban,
  Check,
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

export type BookingEventInfo = {
  id: string;
  name: string;
  companyName: string;
  description: string;
  startDate: string; // ISO
  endDate: string; // ISO
  active: boolean;
  requiresConfirmation: boolean;
};

export type SlotItem = {
  id: string;
  date: string; // ISO
  startTime: string;
  durationMins: number;
  quota: number;
  taken: number;
  available: number;
};

export type BookingItem = {
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

/** An ISO datetime string's date-only prefix — used both as the value for
 *  `<input type="date">` and as a stable group-by key, since it's exactly
 *  what parseDateOnly/dateKey mean by a calendar day server-side. */
function isoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function sortSlots(slots: SlotItem[]): SlotItem[] {
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
  onDecide,
  onDelete,
}: {
  booking: BookingItem;
  onDecide: (status: BookingStatus, decidedNote: string | null) => Promise<string | null>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function handleCancel() {
    setBusy(true);
    setError(null);
    try {
      const warning = await onDecide("CANCELLED", note.trim() || null);
      if (warning) setError(warning);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const warning = await onDecide("CONFIRMED", null);
      if (warning) setError(warning);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setBusy(true);
    setError(null);
    try {
      const warning = await onDecide("REJECTED", note.trim() || null);
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
        t("Permanently delete this booking? This cannot be undone, and — unlike Cancel — the client will NOT be notified. Only do this for test or fake bookings.")
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">{booking.clientName}</p>
        </div>
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
          {t("{date} at {time}", { date: formatDateLabel(booking.slotDate), time: formatTimeRangeLabel(booking.slotStartTime, booking.slotDurationMins) })}
        </p>
        <p className="text-ink-muted">{t("{count} Minutes", { count: booking.slotDurationMins })}</p>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        {booking.clientPhone && (
          <a
            href={`tel:${booking.clientPhone}`}
            className="flex items-center gap-1.5 text-ink-muted hover:text-brand-600 hover:underline"
          >
            <Phone size={13} /> {booking.clientPhone}
          </a>
        )}
        {booking.clientEmail && (
          <a
            href={`mailto:${booking.clientEmail}`}
            className="flex items-center gap-1.5 text-ink-muted hover:text-brand-600 hover:underline"
          >
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

      {booking.status === "REJECTED" && booking.decidedNote && (
        <div>
          <p className="label mb-1">{t("Rejection note")}</p>
          <p className="text-sm text-ink-muted">{booking.decidedNote}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {booking.status === "PENDING" && (
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          {showDecisionForm ? (
            <>
              <textarea
                className="input min-h-[70px] text-sm"
                placeholder={t("Optional note (e.g. why it's being rejected)")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="button" onClick={handleReject} disabled={busy} className="btn-secondary">
                  {busy && <Loader2 size={14} className="animate-spin" />} {t("Confirm reject")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDecisionForm(false)}
                  disabled={busy}
                  className="text-sm text-ink-muted hover:text-ink"
                >
                  {t("Never mind")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirm} disabled={busy} className="btn-primary">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {t("Confirm")}
              </button>
              <button type="button" onClick={() => setShowDecisionForm(true)} disabled={busy} className="btn-secondary">
                <Ban size={15} /> {t("Reject")}
              </button>
            </div>
          )}
        </div>
      )}

      {booking.status === "CONFIRMED" && (
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          {showDecisionForm ? (
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
                <button
                  type="button"
                  onClick={() => setShowDecisionForm(false)}
                  disabled={busy}
                  className="text-sm text-ink-muted hover:text-ink"
                >
                  {t("Never mind")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDecisionForm(true)} disabled={busy} className="btn-secondary">
                <Ban size={15} /> {t("Cancel")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingEventDetailClient({
  event: initialEvent,
  slots: initialSlots,
  bookings: initialBookings,
  bookingUrl,
  manageUrl,
  otherEvents = [],
}: {
  event: BookingEventInfo;
  slots: SlotItem[];
  bookings: BookingItem[];
  /** The public per-event booking page's full URL (e.g. `.../book/{id}`) —
   *  staff copy this to send clients a link to book this specific event. */
  bookingUrl: string;
  /** This event's own public "manage bookings" link (e.g.
   *  `.../manage-booking/{manageToken}`) — staff copy this to hand off
   *  day-to-day management (editing slots/details, cancelling or deleting
   *  bookings) to someone without an HR Plus login, scoped to this one
   *  event only. Null only if a manage token somehow couldn't be generated. */
  manageUrl: string | null;
  otherEvents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const t = useT();
  const [event, setEvent] = useState(initialEvent);
  const [slots, setSlots] = useState(() => sortSlots(initialSlots));
  const [bookings, setBookings] = useState(initialBookings);
  const [modalBooking, setModalBooking] = useState<BookingItem | null>(null);

  // --- Event header: inline edit + active toggle + delete ------------------
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(event.name);
  const [editCompanyName, setEditCompanyName] = useState(event.companyName);
  const [editDescription, setEditDescription] = useState(event.description);
  const [editStartDate, setEditStartDate] = useState(isoDateOnly(event.startDate));
  const [editEndDate, setEditEndDate] = useState(isoDateOnly(event.endDate));
  const [editRequiresConfirmation, setEditRequiresConfirmation] = useState(event.requiresConfirmation);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function startEditing() {
    setEditName(event.name);
    setEditCompanyName(event.companyName);
    setEditDescription(event.description);
    setEditStartDate(isoDateOnly(event.startDate));
    setEditEndDate(isoDateOnly(event.endDate));
    setEditRequiresConfirmation(event.requiresConfirmation);
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/bookings/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          companyName: editCompanyName,
          description: editDescription,
          startDate: editStartDate,
          endDate: editEndDate,
          requiresConfirmation: editRequiresConfirmation,
        }),
      });
      const data = await readJsonOrThrow(res, t("Could not save changes."));
      setEvent((prev) => ({
        ...prev,
        name: data.name,
        companyName: data.companyName,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        requiresConfirmation: data.requiresConfirmation,
      }));
      setEditing(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleActive() {
    setToggleBusy(true);
    try {
      const res = await fetch(`/api/bookings/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !event.active }),
      });
      const data = await res.json();
      if (res.ok) setEvent((prev) => ({ ...prev, active: data.active }));
    } finally {
      setToggleBusy(false);
    }
  }

  async function deleteEvent() {
    if (
      !window.confirm(
        t("Permanently delete \"{name}\" and every one of its time slots? This can't be undone. Blocked if any slot still has a pending or confirmed booking.", { name: event.name })
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/bookings/events/${event.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not delete this event."));
      router.push("/bookings");
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleteBusy(false);
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
      const res = await fetch(`/api/bookings/events/${event.id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readJsonOrThrow(res, t("Could not add the slot(s)."));
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
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editSlotDate, setEditSlotDate] = useState("");
  const [editSlotTime, setEditSlotTime] = useState("09:00");
  const [editSlotDuration, setEditSlotDuration] = useState(DEFAULT_SLOT_DURATION_MINUTES);
  const [editSlotQuota, setEditSlotQuota] = useState(1);
  const [copySourceId, setCopySourceId] = useState(event.id);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  function startSlotEdit(slot: SlotItem) {
    setEditingSlotId(slot.id);
    setEditSlotDate(isoDateOnly(slot.date));
    setEditSlotTime(slot.startTime.slice(0, 5));
    setEditSlotDuration(slot.durationMins);
    setEditSlotQuota(slot.quota);
  }

  async function saveSlotEdit(id: string) {
    setSlotAction((prev) => ({ ...prev, [id]: { busy: true, error: null } }));
    try {
      const res = await fetch(`/api/bookings/events/${event.id}/slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: editSlotDate,
          startTime: editSlotTime,
          durationMins: editSlotDuration,
          quota: editSlotQuota,
        }),
      });
      const data = await readJsonOrThrow(res, t("Could not save this time."));
      setSlots((prev) =>
        sortSlots(
          prev.map((slot) =>
            slot.id === id
              ? {
                  ...slot,
                  date: data.date,
                  startTime: data.startTime,
                  durationMins: data.durationMins,
                  quota: data.quota,
                  taken: data.taken,
                  available: data.available,
                }
              : slot
          )
        )
      );
      setBookings((prev) =>
        prev.map((booking) =>
          booking.slotId === id
            ? {
                ...booking,
                slotDate: data.date,
                slotStartTime: data.startTime,
                slotDurationMins: data.durationMins,
              }
            : booking
        )
      );
      setEditingSlotId(null);
      setSlotAction((prev) => ({ ...prev, [id]: { busy: false, error: null } }));
    } catch (err: any) {
      setSlotAction((prev) => ({ ...prev, [id]: { busy: false, error: err.message } }));
    }
  }

  async function copyTimes() {
    setCopyBusy(true);
    setCopyError(null);
    try {
      const res = await fetch(`/api/bookings/events/${event.id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "copy", sourceEventId: copySourceId, date: addDate }),
      });
      const data = await readJsonOrThrow(res, t("Could not copy those times."));
      const created: { id: string; date: string; startTime: string; durationMins: number; quota: number }[] = data.slots || [];
      setSlots((prev) =>
        sortSlots([
          ...prev,
          ...created.map((slot) => ({
            id: slot.id,
            date: slot.date,
            startTime: slot.startTime,
            durationMins: slot.durationMins,
            quota: slot.quota,
            taken: 0,
            available: slot.quota,
          })),
        ])
      );
    } catch (err: any) {
      setCopyError(err.message);
    } finally {
      setCopyBusy(false);
    }
  }

  async function moveBooking(booking: BookingItem, slotId: string) {
    if (!slotId || slotId === booking.slotId) return;
    setQuickActionId(booking.id);
    setQuickActionError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId }),
      });
      const data = await readJsonOrThrow(res, t("Could not move this booking."));
      const active = booking.status === "PENDING" || booking.status === "CONFIRMED";
      setBookings((prev) =>
        prev.map((row) =>
          row.id === booking.id
            ? {
                ...row,
                slotId: data.slotId,
                slotDate: data.slotDate,
                slotStartTime: data.slotStartTime,
                slotDurationMins: data.slotDurationMins,
              }
            : row
        )
      );
      if (active) {
        setSlots((prev) =>
          prev.map((slot) => {
            if (slot.id !== booking.slotId && slot.id !== data.slotId) return slot;
            const taken = Math.max(0, slot.taken + (slot.id === data.slotId ? 1 : -1));
            return { ...slot, taken, available: Math.max(0, slot.quota - taken) };
          })
        );
      }
    } catch (err: any) {
      setQuickActionError({ id: booking.id, message: err.message });
    } finally {
      setQuickActionId(null);
    }
  }

  async function removeSlot(id: string) {
    if (!window.confirm(t("Remove this time slot? Only possible if no one has ever booked it."))) return;
    setSlotAction((prev) => ({ ...prev, [id]: { busy: true, error: null } }));
    try {
      const res = await fetch(`/api/bookings/events/${event.id}/slots/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not remove this slot."));
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
    const map = new Map<string, SlotItem[]>();
    for (const s of slots) {
      const key = isoDateOnly(s.date);
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [slots]);

  // --- Bookings: decide / delete ---------------------------------------------
  async function handleDecide(id: string, status: BookingStatus, decidedNote: string | null): Promise<string | null> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, decidedNote }),
    });
    const data = await readJsonOrThrow(res, t("Could not save that change."));
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: data.status, decidedNote: data.decidedNote } : b)));
    // A confirmed/cancelled/rejected decision changes how many spots the
    // slot has taken — refresh that slot's counts locally rather than
    // re-fetching the whole page.
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== data.slotId) return s;
        // A slot's "taken" count includes PENDING bookings too (see
        // listSlotsForEvent's SQL) — a still-unreviewed request already
        // holds the spot, the same as a confirmed one.
        const activeStatuses = ["PENDING", "CONFIRMED"];
        const wasActive = activeStatuses.includes(bookings.find((b) => b.id === id)?.status || "");
        const isActive = activeStatuses.includes(data.status);
        const takenDelta = (isActive ? 1 : 0) - (wasActive ? 1 : 0);
        const taken = Math.max(0, s.taken + takenDelta);
        return { ...s, taken, available: Math.max(0, s.quota - taken) };
      })
    );
    setModalBooking((m) => (m && m.id === id ? { ...m, status: data.status, decidedNote: data.decidedNote } : m));
    return data.emailWarning || null;
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t("Could not delete this booking."));
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setModalBooking(null);
  }

  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "PENDING")
        .sort((a, b) => (a.slotDate === b.slotDate ? a.slotStartTime.localeCompare(b.slotStartTime) : a.slotDate.localeCompare(b.slotDate))),
    [bookings]
  );
  const [quickActionId, setQuickActionId] = useState<string | null>(null);
  const [quickActionError, setQuickActionError] = useState<{ id: string; message: string } | null>(null);

  async function quickConfirm(id: string) {
    setQuickActionId(id);
    setQuickActionError(null);
    try {
      const warning = await handleDecide(id, "CONFIRMED", null);
      if (warning) setQuickActionError({ id, message: warning });
    } catch (err: any) {
      setQuickActionError({ id, message: err.message });
    } finally {
      setQuickActionId(null);
    }
  }

  async function quickReject(booking: BookingItem) {
    if (
      !window.confirm(
        t("Reject the booking request from {name}? They'll be emailed a note that it couldn't be confirmed — use the full booking view instead if you want to add a reason.", { name: booking.clientName })
      )
    ) {
      return;
    }
    setQuickActionId(booking.id);
    setQuickActionError(null);
    try {
      const warning = await handleDecide(booking.id, "REJECTED", null);
      if (warning) setQuickActionError({ id: booking.id, message: warning });
    } catch (err: any) {
      setQuickActionError({ id: booking.id, message: err.message });
    } finally {
      setQuickActionId(null);
    }
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
  const rejectedBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "REJECTED")
        .sort((a, b) => (a.slotDate === b.slotDate ? b.slotStartTime.localeCompare(a.slotStartTime) : b.slotDate.localeCompare(a.slotDate))),
    [bookings]
  );
  const [showRejected, setShowRejected] = useState(false);

  function BookingRow({ b }: { b: BookingItem }) {
    const t = useT();
    return (
      <button
        type="button"
        onClick={() => setModalBooking(b)}
        className="flex items-center justify-between gap-3 py-2.5 text-left hover:bg-paper -mx-1 px-1 rounded-lg transition-colors w-full"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink truncate">
            {formatDateLabel(b.slotDate)} · {formatTimeRangeLabel(b.slotStartTime, b.slotDurationMins)} · {b.clientName}
          </p>
        </div>
        <span className={clsx("stamp shrink-0", STATUS_BADGE_STYLES[b.status])}>{t(b.status)}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
              <input
                type="text"
                className="input"
                value={editCompanyName}
                onChange={(e) => setEditCompanyName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Description")}</label>
              <textarea
                className="input min-h-[70px]"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
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
            <label className="flex items-start gap-2.5 rounded-xl border border-line p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={editRequiresConfirmation}
                onChange={(e) => setEditRequiresConfirmation(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-medium text-ink">{t("Require staff confirmation")}</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  {t("New bookings wait in “Pending requests” below until confirmed here — the client's confirmation email isn't sent until then.")}
                </span>
              </span>
            </label>
            {editError && (
              <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{editError}</span>
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
                {event.requiresConfirmation && (
                  <span className="stamp border-amber-500 text-amber-600 bg-amber-50">{t("Requires confirmation")}</span>
                )}
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
              <CopySigningLinkButton
                url={bookingUrl}
                label={t("Copy booking link")}
                title={t("Copy this event's public booking link to send to clients")}
              />
              {manageUrl && (
                <CopySigningLinkButton
                  url={manageUrl}
                  label={t("Copy manage link")}
                  title={t("Copy this event's public manage link — anyone with it can edit its details/slots and cancel or delete its bookings, without logging in")}
                />
              )}
              <button type="button" onClick={toggleActive} disabled={toggleBusy} className="btn-secondary">
                {toggleBusy && <Loader2 size={14} className="animate-spin" />}
                {event.active ? t("Hide from public page") : t("Show on public page")}
              </button>
              <button type="button" onClick={startEditing} className="btn-secondary">
                <Pencil size={14} /> {t("Edit")}
              </button>
              <button
                type="button"
                onClick={deleteEvent}
                disabled={deleteBusy}
                className="text-ink-faint hover:text-danger-600 transition-colors disabled:opacity-50 p-2"
                title={t("Delete event")}
                aria-label={t("Delete event")}
              >
                {deleteBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          </div>
        )}
        {deleteError && <p className="text-sm text-danger-600 mt-3">{deleteError}</p>}
      </div>

      {/* Slots */}
      <div className="card p-5 sm:p-6 flex flex-col gap-5">
        <h2 className="font-display text-lg font-semibold text-ink">{t("Time Slots")}</h2>

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

          <div className="max-w-xs">
            <label className="label">{t("How long is each appointment?")}</label>
            <input
              type="number"
              className="input"
              min={SLOT_DURATION_MIN_MINUTES}
              max={SLOT_DURATION_MAX_MINUTES}
              step={SLOT_DURATION_STEP_MINUTES}
              value={addDuration}
              onChange={(e) =>
                setAddDuration(
                  Math.min(SLOT_DURATION_MAX_MINUTES, Math.max(SLOT_DURATION_MIN_MINUTES, Number(e.target.value) || 0))
                )
              }
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
              <span>{addError}</span>
            </div>
          )}

          <button type="submit" disabled={addBusy} className="btn-primary self-start">
            {addBusy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {addMode === "single" ? t("Add this time") : t("Add these times")}
          </button>
        </form>

        <div className="rounded-xl border border-line p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-ink">{t("Copy times from another event")}</p>
            <p className="text-xs text-ink-muted mt-0.5">
              {t("Copies the first day's times onto the date above. Change the date first if you need a different day.")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select className="input sm:max-w-xs" value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)}>
              <option value={event.id}>{t("This event's first day")}</option>
              {otherEvents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={copyTimes} disabled={copyBusy} className="btn-secondary shrink-0">
              {copyBusy && <Loader2 size={14} className="animate-spin" />}
              {t("Copy times")}
            </button>
          </div>
          {copyError && <p className="text-sm text-danger-600">{t(copyError)}</p>}
        </div>

        {slotGroups.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No time slots yet — add one above to start taking bookings.")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {slotGroups.map(([dateStr, group]) => (
              <div key={dateStr}>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                  {formatDateLabel(dateStr)}
                </p>
                <div className="flex flex-col divide-y divide-line rounded-xl border border-line overflow-hidden">
                  {group.map((s) => {
                    const action = slotAction[s.id];
                    const people = bookings.filter(
                      (booking) => booking.slotId === s.id && (booking.status === "PENDING" || booking.status === "CONFIRMED")
                    );
                    const moveTargets = slots.filter((slot) => slot.id !== s.id && slot.available > 0);
                    return (
                      <div key={s.id} className="flex flex-col gap-2 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">{formatTimeRangeLabel(s.startTime, s.durationMins)}</p>
                            <p className="text-xs text-ink-muted">
                              {t("{taken}/{quota} booked", { taken: s.taken, quota: s.quota })}
                              {s.available <= 0 ? t(" · Full") : ""}
                            </p>
                            {action?.error && <p className="text-xs text-danger-600 mt-0.5">{action.error}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => (editingSlotId === s.id ? setEditingSlotId(null) : startSlotEdit(s))}
                              className="text-ink-faint hover:text-ink transition-colors p-2"
                              aria-label={t("Change this time")}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSlot(s.id)}
                              disabled={action?.busy}
                              title={t("Remove slot")}
                              aria-label={t("Remove slot")}
                              className="text-ink-faint hover:text-danger-600 transition-colors disabled:opacity-50 p-2"
                            >
                              {action?.busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                        {editingSlotId === s.id && (
                          <div className="flex flex-col gap-3 rounded-md border border-line bg-paper p-3">
                            <div className="max-w-xs">
                              <label className="label">{t("Date")}</label>
                              <input
                                type="date"
                                className="input"
                                value={editSlotDate}
                                min={isoDateOnly(event.startDate)}
                                max={isoDateOnly(event.endDate)}
                                onChange={(e) => setEditSlotDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="label">{t("Start time")}</label>
                              <BookingTimeField value={editSlotTime} onChange={setEditSlotTime} />
                            </div>
                            <div className="max-w-[220px]">
                              <label className="label">{t("How long is each appointment?")}</label>
                              <input
                                type="number"
                                className="input"
                                min={SLOT_DURATION_MIN_MINUTES}
                                max={SLOT_DURATION_MAX_MINUTES}
                                step={SLOT_DURATION_STEP_MINUTES}
                                value={editSlotDuration}
                                onChange={(e) =>
                                  setEditSlotDuration(
                                    Math.min(
                                      SLOT_DURATION_MAX_MINUTES,
                                      Math.max(SLOT_DURATION_MIN_MINUTES, Number(e.target.value) || 0)
                                    )
                                  )
                                }
                              />
                            </div>
                            <div className="max-w-[160px]">
                              <label className="label">{t("How many people can book each time?")}</label>
                              <input
                                type="number"
                                className="input"
                                min={Math.max(1, s.taken)}
                                max={MAX_SLOT_QUOTA}
                                value={editSlotQuota}
                                onChange={(e) => setEditSlotQuota(Math.max(1, Number(e.target.value) || 1))}
                              />
                            </div>
                            <p className="text-xs text-ink-muted">
                              {t("People already booked stay on this time. They are not emailed.")}
                            </p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => saveSlotEdit(s.id)} disabled={action?.busy} className="btn-primary">
                                {action?.busy && <Loader2 size={14} className="animate-spin" />}
                                {t("Save time")}
                              </button>
                              <button type="button" onClick={() => setEditingSlotId(null)} className="btn-secondary">
                                {t("Cancel")}
                              </button>
                            </div>
                          </div>
                        )}
                        {people.length > 0 && (
                          <ul className="flex flex-col gap-2 border-t border-line pt-2">
                            {people.map((person) => (
                              <li key={person.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <button type="button" onClick={() => setModalBooking(person)} className="text-sm font-medium text-ink text-left hover:underline">
                                  {person.clientName}
                                </button>
                                <span className={clsx("stamp", STATUS_BADGE_STYLES[person.status])}>{t(person.status)}</span>
                                {person.status === "PENDING" && (
                                  <span className="flex gap-1">
                                    <button type="button" onClick={() => quickConfirm(person.id)} className="btn-primary !py-1 !px-2 text-xs">
                                      {t("Confirm")}
                                    </button>
                                    <button type="button" onClick={() => quickReject(person)} className="btn-secondary !py-1 !px-2 text-xs">
                                      {t("Reject")}
                                    </button>
                                  </span>
                                )}
                                {moveTargets.length > 0 && (
                                  <select
                                    className="input sm:ml-auto sm:max-w-[220px] !py-1 text-xs"
                                    defaultValue=""
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      e.target.value = "";
                                      void moveBooking(person, next);
                                    }}
                                  >
                                    <option value="">{t("Move to another time")}</option>
                                    {moveTargets.map((slot) => (
                                      <option key={slot.id} value={slot.id}>
                                        {formatDateLabel(slot.date)} · {formatTimeRangeLabel(slot.startTime, slot.durationMins)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending requests */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Pending Requests")}</h2>
          {pendingBookings.length > 0 && (
            <span className="stamp border-amber-500 text-amber-600 bg-amber-50">{pendingBookings.length}</span>
          )}
        </div>
        {pendingBookings.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("No pending requests right now.")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {pendingBookings.map((b) => {
              const busy = quickActionId === b.id;
              return (
                <div key={b.id} className="flex flex-col gap-1.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setModalBooking(b)} className="min-w-0 text-left hover:opacity-70 transition-opacity">
                      <p className="text-sm font-medium text-ink truncate">
                        {formatDateLabel(b.slotDate)} · {formatTimeRangeLabel(b.slotStartTime, b.slotDurationMins)} · {b.clientName}
                      </p>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => quickConfirm(b.id)} disabled={busy} className="btn-primary !py-1.5 !px-3 text-xs">
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        {t("Confirm")}
                      </button>
                      <button type="button" onClick={() => quickReject(b)} disabled={busy} className="btn-secondary !py-1.5 !px-3 text-xs">
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        {t("Reject")}
                      </button>
                    </div>
                  </div>
                  {quickActionError?.id === b.id && <p className="text-xs text-danger-600">{quickActionError.message}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmed bookings */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Confirmed Bookings")}</h2>
          {confirmedBookings.length > 0 && (
            <span className="stamp border-brand-500 text-brand-600 bg-brand-50">{confirmedBookings.length}</span>
          )}
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
          <h2 className="font-display text-lg font-semibold text-ink">{t("Cancelled Bookings")}</h2>
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

      {/* Rejected */}
      <div className="card p-4 sm:p-5">
        <button type="button" onClick={() => setShowRejected((v) => !v)} className="flex items-center justify-between gap-3 w-full text-left">
          <h2 className="font-display text-lg font-semibold text-ink">{t("Rejected Requests")}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {rejectedBookings.length > 0 && <span className="stamp border-ink-faint text-ink-faint">{rejectedBookings.length}</span>}
            {showRejected ? <ChevronUp size={16} className="text-ink-faint" /> : <ChevronDown size={16} className="text-ink-faint" />}
          </div>
        </button>
        {showRejected &&
          (rejectedBookings.length === 0 ? (
            <p className="text-sm text-ink-muted mt-3">{t("No rejected requests.")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-line mt-3">
              {rejectedBookings.map((b) => (
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
                onDecide={(status, decidedNote) => handleDecide(modalBooking.id, status, decidedNote)}
                onDelete={() => handleDelete(modalBooking.id)}
              />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
