import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import {
  countActiveBookingsForSlot,
  countAnyBookingsForSlot,
  deleteSlot,
  formatSlotLabel,
  getBookingEvent,
  getSlot,
  slotFieldsFrom,
  updateSlot,
} from "@/lib/bookings";

export const dynamic = "force-dynamic";

/**
 * Remove a slot that turned out not to be needed. Blocked entirely once any
 * booking (of any status, including cancelled/rejected) has ever been made
 * against it — deleting it would otherwise silently discard that history via
 * the cascade FK. Staff can still hide a slot's usefulness some other way
 * (e.g. it'll simply stop being offered once its date has passed); this is
 * only for cleaning up a slot added by mistake before anyone's booked it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; slotId: string } }
) {
  const event = await getBookingEvent(params.id);
  const slot = await getSlot(params.slotId);
  if (!event || !slot || slot.eventId !== params.id) {
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = slotFieldsFrom(body, event);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const taken = await countActiveBookingsForSlot(params.slotId);
  if (fields.quota < taken) {
    return NextResponse.json(
      { error: `This time already has ${taken} booking${taken === 1 ? "" : "s"}. Allow at least that many people.` },
      { status: 409 }
    );
  }

  const updated = await updateSlot(params.slotId, {
    date: fields.date!,
    startTime: fields.startTime,
    durationMins: fields.durationMins,
    quota: fields.quota,
  });

  await logActivity({
    documentType: "booking",
    documentId: params.id,
    type: "EDITED",
    description: `Slot updated: ${formatSlotLabel(fields.date!, fields.startTime, fields.durationMins)}`,
  });

  return NextResponse.json({ ...updated, taken, available: Math.max(0, fields.quota - taken) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; slotId: string } }
) {
  const slot = await getSlot(params.slotId);
  if (!slot || slot.eventId !== params.id) {
    return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  }

  const bookingCount = await countAnyBookingsForSlot(params.slotId);
  if (bookingCount > 0) {
    return NextResponse.json(
      { error: "This slot already has booking history and can't be deleted." },
      { status: 409 }
    );
  }

  await logActivity({
    documentType: "booking",
    documentId: params.id,
    type: "EDITED",
    description: `Slot removed: ${formatSlotLabel(slot.date, slot.startTime, slot.durationMins)}`,
  });

  await deleteSlot(params.slotId);

  return NextResponse.json({ success: true });
}
