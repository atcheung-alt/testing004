import { NextRequest, NextResponse } from "next/server";
import { formatSlotLabel, getBookingWithSlotAndEvent } from "@/lib/bookings";

export const dynamic = "force-dynamic";

/** The client reopens the same booking link and sees the latest day and time. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  const eventId = request.nextUrl.searchParams.get("eventId") || "";
  const booking = id ? await getBookingWithSlotAndEvent(id) : null;
  if (!booking || booking.eventId !== eventId) {
    return NextResponse.json({ booking: null });
  }
  return NextResponse.json({
    booking: {
      id: booking.id,
      name: booking.clientName,
      status: booking.status,
      slotLabel: formatSlotLabel(booking.slotDate, booking.slotStartTime, booking.slotDurationMins),
    },
  });
}
