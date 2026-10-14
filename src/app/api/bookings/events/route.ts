import { NextRequest, NextResponse } from "next/server";
import { companyWhere, ownerCompanyId, requireSectionApi, rowInCompanyScope } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { bookingEventFieldsFrom, createBookingEvent, listBookingEvents } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** GET — every booking event, most recent start date first, for the staff
 *  /bookings list page. */
export async function GET() {
  const denied = await requireSectionApi("bookings");
  if (denied) return denied;

  const scope = await companyWhere();
  const events = await listBookingEvents();
  return NextResponse.json({ events: events.filter((event) => rowInCompanyScope(scope, event.companyId)) });
}

/** POST — create a new bookable event (e.g. "Massage", "DIY Workshop").
 *  Starts with no slots — staff add those from the event's own detail page
 *  next. */
export async function POST(request: NextRequest) {
  const denied = await requireSectionApi("bookings");
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const fields = bookingEventFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  // Wrapped in try/catch so a schema mismatch (a column this raw SQL insert
  // expects that a `prisma db push` hasn't been re-run to add yet) or any
  // other unexpected DB error returns a clean JSON error instead of crashing
  // the route — an unhandled throw here can come back with an EMPTY body on
  // some runtimes, which makes the client's `res.json()` throw its own
  // cryptic parse error instead of showing a real message.
  try {
    const event = await createBookingEvent({
      name: fields.name,
      description: fields.description,
      companyName: fields.companyName,
      startDate: fields.startDate!,
      endDate: fields.endDate!,
      // Deliberately read directly from the body rather than threaded
      // through bookingEventFieldsFrom — this staff-only route is the only
      // place this flag can be set (see the schema comment on
      // BookingEvent.requiresConfirmation).
      requiresConfirmation: body.requiresConfirmation === true,
      companyId: await ownerCompanyId(),
    });

    await logActivity({
      documentType: "booking",
      documentId: event.id,
      type: "CREATED",
      description: `Booking event "${event.name}" created`,
    });

    return NextResponse.json(event, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create booking event:", err);
    return NextResponse.json(
      { error: "Could not create this event — the database may be out of date. Please contact support." },
      { status: 500 }
    );
  }
}
