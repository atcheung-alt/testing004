import { notFound } from "next/navigation";
import { ensureBookingEventManageToken, getBookingEvent, listBookingEvents, listBookingsForEvent, listSlotsForEvent } from "@/lib/bookings";
import { bookingEventUrlFromHeaders, manageBookingEventUrlFromHeaders } from "@/lib/signing";
import BookingEventDetailClient from "@/components/BookingEventDetailClient";
import MassageBookingPanel from "@/components/MassageBookingPanel";

export const dynamic = "force-dynamic";

export default async function BookingEventDetailPage({ params }: { params: { id: string } }) {
  const event = await getBookingEvent(params.id);
  if (!event) notFound();

  const [slots, bookings, manageToken, events] = await Promise.all([
    listSlotsForEvent(params.id),
    listBookingsForEvent(params.id),
    // Older events created before the public manage link shipped won't have
    // one yet — generate and persist it now, the first time staff opens this
    // page, rather than a separate one-off backfill script.
    ensureBookingEventManageToken(params.id),
    listBookingEvents(),
  ]);

  const bookingUrl = bookingEventUrlFromHeaders(event.id);
  const manageUrl = manageToken ? manageBookingEventUrlFromHeaders(manageToken) : null;

  return (
    <div className="flex flex-col gap-6">
      <MassageBookingPanel
        bookingEventId={event.id}
        eventName={event.name}
        description={event.description}
      />
      <BookingEventDetailClient
      bookingUrl={bookingUrl}
      manageUrl={manageUrl}
      event={{
        id: event.id,
        name: event.name,
        companyName: event.companyName,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        active: event.active,
        requiresConfirmation: event.requiresConfirmation,
      }}
      slots={slots.map((s) => ({
        id: s.id,
        date: s.date.toISOString(),
        startTime: s.startTime,
        durationMins: s.durationMins,
        quota: s.quota,
        taken: s.taken,
        available: s.available,
      }))}
      bookings={bookings.map((b) => ({
        id: b.id,
        slotId: b.slotId,
        clientName: b.clientName,
        clientPhone: b.clientPhone,
        clientEmail: b.clientEmail,
        notes: b.notes,
        status: b.status,
        decidedNote: b.decidedNote,
        slotDate: b.slotDate.toISOString(),
        slotStartTime: b.slotStartTime,
        slotDurationMins: b.slotDurationMins,
      }))}
        otherEvents={events.filter((item) => item.id !== event.id).map((item) => ({ id: item.id, name: item.name }))}
      />
    </div>
  );
}
