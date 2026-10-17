import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import {
  bookingEventFieldsFrom,
  countActiveBookingsForEvent,
  deleteBookingEvent,
  getBookingEvent,
  listSlotsForEvent,
  setBookingEventActive,
  updateBookingEvent,
} from "@/lib/bookings";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const event = await getBookingEvent(params.id);
  if (!event) {
    return NextResponse.json({ error: "Booking event not found." }, { status: 404 });
  }
  const slots = await listSlotsForEvent(params.id);
  return NextResponse.json({ event, slots });
}

/**
 * Edit an event's name/description/date range, or flip its `active` flag on
 * its own (a lightweight `{ active }`-only body skips the full field
 * validation, since toggling visibility shouldn't require re-submitting
 * every other field).
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await getBookingEvent(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Booking event not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  if (typeof body.active === "boolean" && Object.keys(body).length === 1) {
    const event = await setBookingEventActive(params.id, body.active);
    return NextResponse.json(event);
  }

  const fields = bookingEventFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const active = typeof body.active === "boolean" ? body.active : existing.active;
  // Read directly from the body, same as `active` above — this signed-in
  // staff route is the only place this can be changed; the
  // public manage-link route always passes the event's current value back
  // unchanged (see the schema comment on BookingEvent.requiresConfirmation).
  const requiresConfirmation =
    typeof body.requiresConfirmation === "boolean" ? body.requiresConfirmation : existing.requiresConfirmation;
  try {
    const event = await updateBookingEvent(params.id, {
      name: fields.name,
      description: fields.description,
      companyName: fields.companyName,
      startDate: fields.startDate!,
      endDate: fields.endDate!,
      active,
      requiresConfirmation,
    });

    await logActivity({
      documentType: "booking",
      documentId: params.id,
      type: "EDITED",
      description: `Booking event "${fields.name}" updated`,
    });

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("Failed to update booking event:", err);
    return NextResponse.json(
      { error: "Could not save changes — the database may be out of date. Please contact support." },
      { status: 500 }
    );
  }
}

/**
 * Permanently delete an event and every slot/booking history under it
 * (cascades at the DB level — see prisma/schema.prisma). Blocked while any
 * slot still has a PENDING or CONFIRMED booking on it, the same "call it off
 * properly first" guard the single-booking DELETE route already enforces —
 * an event with only cancelled/rejected (or no) bookings can be removed
 * outright.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await getBookingEvent(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Booking event not found." }, { status: 404 });
  }

  const activeCount = await countActiveBookingsForEvent(params.id);
  if (activeCount > 0) {
    return NextResponse.json(
      {
        error: `This event still has ${activeCount} pending or confirmed booking${
          activeCount === 1 ? "" : "s"
        } — reject or cancel them first.`,
      },
      { status: 409 }
    );
  }

  await logActivity({
    documentType: "booking",
    documentId: existing.id,
    type: "DELETED",
    description: `Booking event "${existing.name}" deleted`,
  });

  await deleteBookingEvent(params.id);

  return NextResponse.json({ success: true });
}
