import { NextRequest, NextResponse } from "next/server";
import { getClientIp, bookingCancelUrlFor } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { sendDocumentEmail } from "@/lib/mailer";
import { bookingConfirmedEmailContent, bookingPendingEmailContent } from "@/lib/settings";
import { getEffectiveCompany } from "@/lib/appSettings";
import {
  bookingFieldsFrom,
  buildGoogleCalendarUrl,
  createBooking,
  formatSlotLabel,
  getBookingEvent,
  getSlot,
  isDateBookable,
  isSlotInFuture,
  listSlotsForEventOnDate,
} from "@/lib/bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Submit a new booking against a specific slot. Starts CONFIRMED and sends
 * the real thank-you email immediately, unless the event has
 * `requiresConfirmation` on, in which case it starts PENDING and gets the
 * "we've received your request" email instead — staff then confirm it from
 * the internal admin page, which is what sends the actual confirmation email
 * (see the PATCH on /api/bookings/[id]). Either way there's a self-service
 * cancel link (see /booking-cancel/[token]). No login, no per-record token to
 * submit — a plain public form (see src/app/book/[id]/page.tsx).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const slotId = typeof body.slotId === "string" ? body.slotId : "";
  const slot = slotId ? await getSlot(slotId) : null;
  if (!slot) {
    return NextResponse.json({ error: "That time slot no longer exists. Please pick another." }, { status: 404 });
  }

  const event = await getBookingEvent(slot.eventId);
  if (!event || !event.active) {
    return NextResponse.json({ error: "This event is no longer available for booking." }, { status: 404 });
  }
  if (!isDateBookable(slot.date) || !isSlotInFuture(slot.date, slot.startTime)) {
    return NextResponse.json({ error: "That time has already passed. Please pick another." }, { status: 409 });
  }

  const fields = bookingFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  // Re-check availability right before creating — the client-side slot list
  // could be stale (another booking came in since the page loaded).
  const freshSlots = await listSlotsForEventOnDate(slot.eventId, slot.date);
  const fresh = freshSlots.find((s) => s.id === slotId);
  if (!fresh || fresh.available <= 0) {
    return NextResponse.json(
      { error: "Sorry, that slot was just fully booked. Please pick another." },
      { status: 409 }
    );
  }

  let booking;
  try {
    booking = await createBooking(slotId, fields, getClientIp(request), true);
  } catch (err: any) {
    // A schema mismatch (a column this raw SQL insert expects that hasn't
    // been pushed to the DB yet) or any other unexpected DB error should
    // return a clean JSON error, not crash — an unhandled throw here can
    // come back with an EMPTY body on some runtimes, which makes the
    // client's `res.json()` throw its own cryptic parse error instead of
    // showing the visitor a real message.
    console.error("Failed to create booking:", err);
    return NextResponse.json(
      { error: "Could not submit this booking. Please try again in a moment." },
      { status: 500 }
    );
  }
  const slotLabel = formatSlotLabel(slot.date, slot.startTime, slot.durationMins);
  const isPending = booking.status === "PENDING";

  await logActivity({
    documentType: "booking",
    documentId: booking.id,
    type: "CREATED",
    actor: "CLIENT",
    actorName: booking.clientName,
    description: isPending
      ? `Booking requested for ${event.name} — ${slotLabel} (awaiting staff confirmation)`
      : `Booking confirmed for ${event.name} — ${slotLabel}`,
  });

  // Best-effort: a client with no email on file, or a misconfigured/failing
  // SMTP server, must never block the booking itself from succeeding.
  if (booking.clientEmail) {
    try {
      const company = await getEffectiveCompany();
      const cancelUrl = bookingCancelUrlFor(booking.cancelToken, request);
      const companyName = company.shortName || company.name;
      const emailContentFor = isPending ? bookingPendingEmailContent : bookingConfirmedEmailContent;
      const { subject, body: emailBody } = emailContentFor({
        clientName: booking.clientName,
        eventName: event.name,
        slotLabel,
        companyName,
        cancelUrl,
      });
      // Only a real, immediate confirmation gets a calendar invite — a
      // requiresConfirmation event's PENDING request has nothing to add to a
      // calendar yet (see bookingConfirmedEmailContent sent again for real
      // once staff confirm it, in PATCH /api/bookings/[id]).
      await sendDocumentEmail({
        to: booking.clientEmail,
        subject,
        body: emailBody,
        secondaryCtaUrl: isPending
          ? undefined
          : buildGoogleCalendarUrl({
              eventName: event.name,
              date: slot.date,
              startTime: slot.startTime,
              durationMins: slot.durationMins,
              details: `Booking with ${companyName}`,
            }),
        secondaryCtaLabel: "Add to Google Calendar",
      });
      await logActivity({
        documentType: "booking",
        documentId: booking.id,
        type: "EMAIL_SENT",
        actor: "SYSTEM",
        description: `${isPending ? "Booking request received" : "Booking confirmation"} emailed to ${booking.clientEmail}`,
      });
    } catch {
      // Swallow — the booking already succeeded; there's no client-facing
      // field to surface an email warning into on this public form.
    }
  }

  return NextResponse.json(
    {
      id: booking.id,
      eventName: event.name,
      date: slot.date.toISOString(),
      startTime: slot.startTime,
      durationMins: slot.durationMins,
      status: booking.status,
    },
    { status: 201 }
  );
}
