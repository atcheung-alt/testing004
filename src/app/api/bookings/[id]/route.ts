import { NextRequest, NextResponse } from "next/server";
import { requireSectionApi } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { sendDocumentEmail } from "@/lib/mailer";
import { bookingCancelledEmailContent, bookingConfirmedEmailContent, bookingRejectedEmailContent } from "@/lib/settings";
import { getEffectiveCompany } from "@/lib/appSettings";
import { bookingCancelUrlFor } from "@/lib/signing";
import {
  DECIDABLE_FROM_STATUS,
  VALID_BOOKING_STATUSES,
  buildGoogleCalendarUrl,
  countActiveBookingsForSlot,
  deleteBooking,
  formatSlotLabel,
  getBookingWithSlotAndEvent,
  getSlot,
  moveBookingToSlot,
  updateBookingStatus,
  type BookingStatus,
} from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * Confirm, reject, or cancel a booking from an event's staff detail page
 * (Resource System → Bookings). Same transition table as the old
 * single-resource system — see DECIDABLE_FROM_STATUS in src/lib/bookings.ts.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSectionApi("bookings");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));

  if (typeof body.slotId === "string" && body.slotId && body.status === undefined) {
    const existing = await getBookingWithSlotAndEvent(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    if (existing.status !== "PENDING" && existing.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Only an open booking can be moved to another time." }, { status: 409 });
    }
    if (existing.slotId === body.slotId) {
      return NextResponse.json(existing);
    }
    const target = await getSlot(body.slotId);
    if (!target || target.eventId !== existing.eventId) {
      return NextResponse.json({ error: "Choose a time on this same event." }, { status: 400 });
    }
    const taken = await countActiveBookingsForSlot(target.id);
    if (taken >= target.quota) {
      return NextResponse.json({ error: "That time is already full." }, { status: 409 });
    }
    await moveBookingToSlot(params.id, target.id);
    await logActivity({
      documentType: "booking",
      documentId: params.id,
      type: "EDITED",
      description: `Booking for ${existing.clientName} moved to ${formatSlotLabel(target.date, target.startTime, target.durationMins)}`,
    });
    return NextResponse.json({
      id: existing.id,
      slotId: target.id,
      status: existing.status,
      slotDate: target.date,
      slotStartTime: target.startTime,
      slotDurationMins: target.durationMins,
    });
  }

  const nextStatus: BookingStatus | undefined = VALID_BOOKING_STATUSES.includes(body.status)
    ? body.status
    : undefined;
  if (!nextStatus) {
    return NextResponse.json(
      { error: `Status must be one of ${VALID_BOOKING_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  const existing = await getBookingWithSlotAndEvent(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const currentStatus = existing.status;
  if (!DECIDABLE_FROM_STATUS[currentStatus]?.includes(nextStatus)) {
    return NextResponse.json(
      { error: `A ${currentStatus.toLowerCase()} booking can't be moved to ${nextStatus.toLowerCase()}.` },
      { status: 409 }
    );
  }

  const decidedNote = typeof body.decidedNote === "string" ? body.decidedNote.trim() || null : null;
  const booking = await updateBookingStatus(params.id, nextStatus, decidedNote);

  const slotLabel = formatSlotLabel(existing.slotDate, existing.slotStartTime, existing.slotDurationMins);
  const statusVerb =
    nextStatus === "CONFIRMED" ? "confirmed" : nextStatus === "REJECTED" ? "rejected" : "cancelled";
  await logActivity({
    documentType: "booking",
    documentId: params.id,
    type: "EDITED",
    description: `Booking for ${existing.clientName} (${existing.eventName}, ${slotLabel}) ${statusVerb}`,
  });

  // Confirming a pending request, rejecting one, or cancelling an already-
  // confirmed booking all notify the client by email; deleting a booking
  // outright never does (see the DELETE handler below). Best-effort: a
  // client with no email on file, or a misconfigured/failing SMTP server,
  // must never block the status change itself — surfaced back to staff as a
  // warning instead.
  let emailWarning: string | null = null;
  if (nextStatus === "CANCELLED" || nextStatus === "REJECTED" || nextStatus === "CONFIRMED") {
    if (!existing.clientEmail) {
      emailWarning = "The client has no email on file — please let them know by phone instead.";
    } else {
      try {
        const company = await getEffectiveCompany();
        const companyName = company.shortName || company.name;
        if (nextStatus === "CONFIRMED") {
          // This only ever fires for a PENDING → CONFIRMED decision (see
          // DECIDABLE_FROM_STATUS) — a booking that started CONFIRMED
          // already got this email at submission time (see
          // POST /api/public/bookings), so this is that same "real"
          // confirmation notice, just sent once staff actually approve it.
          const { subject, body: emailBody } = bookingConfirmedEmailContent({
            clientName: existing.clientName,
            eventName: existing.eventName,
            slotLabel,
            companyName,
            cancelUrl: bookingCancelUrlFor(existing.cancelToken, request),
          });
          await sendDocumentEmail({
            to: existing.clientEmail,
            subject,
            body: emailBody,
            secondaryCtaUrl: buildGoogleCalendarUrl({
              eventName: existing.eventName,
              date: existing.slotDate,
              startTime: existing.slotStartTime,
              durationMins: existing.slotDurationMins,
              details: `Booking with ${companyName}`,
            }),
            secondaryCtaLabel: "Add to Google Calendar",
          });
        } else {
          const emailContentFor = nextStatus === "CANCELLED" ? bookingCancelledEmailContent : bookingRejectedEmailContent;
          const { subject, body: emailBody } = emailContentFor({
            clientName: existing.clientName,
            slotLabel: `${existing.eventName} — ${slotLabel}`,
            decidedNote,
            companyName,
          });
          await sendDocumentEmail({ to: existing.clientEmail, subject, body: emailBody });
        }
        await logActivity({
          documentType: "booking",
          documentId: params.id,
          type: "EMAIL_SENT",
          actor: "SYSTEM",
          description: `${statusVerb === "confirmed" ? "Confirmation" : statusVerb === "cancelled" ? "Cancellation" : "Rejection"} notice emailed to ${existing.clientEmail}`,
        });
      } catch (err: any) {
        emailWarning = err?.message || `Could not email the client about this ${statusVerb}.`;
      }
    }
  }

  return NextResponse.json({ ...booking, emailWarning });
}

/**
 * Permanently delete a booking — never notifies the client, unlike Reject/
 * Cancel. Meant for cleaning up test/fake requests, not turning away a real
 * client. A CONFIRMED booking can't be deleted at all — call it off through
 * Cancel instead so the client is actually told.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSectionApi("bookings");
  if (denied) return denied;

  const existing = await getBookingWithSlotAndEvent(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  if (existing.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "A confirmed booking can't be deleted — cancel it instead so the client is notified." },
      { status: 409 }
    );
  }

  await logActivity({
    documentType: "booking",
    documentId: existing.id,
    type: "DELETED",
    description: `Booking for ${existing.clientName} (${existing.eventName}, ${formatSlotLabel(
      existing.slotDate,
      existing.slotStartTime,
      existing.slotDurationMins
    )}) deleted — no client notification sent`,
  });

  await deleteBooking(params.id);

  return NextResponse.json({ success: true });
}
