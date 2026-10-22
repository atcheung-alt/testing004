import Link from "next/link";
import { Plus, CalendarCheck } from "lucide-react";
import { listBookingEvents } from "@/lib/bookings";
import { listEvents } from "@/lib/events";
import EmptyState from "@/components/EmptyState";
import BookingEventListClient from "@/components/BookingEventListClient";
import BookingEventsCalendar from "@/components/BookingEventsCalendar";
import PageBar from "@/components/PageBar";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Staff-facing entry point for the event-based booking system (Resource
 * System) — every bookable event (a massage day, a multi-day workshop,
 * etc.) staff have created, each with its own detail page for managing
 * slots and reviewing bookings. Lives under the (app) route group rather
 * than the HR System — see the note that used to live here before the
 * single-resource massage calendar was replaced by this event system.
 */
export default async function BookingsPage() {
  const t = getT();

  const [events, jobs] = await Promise.all([listBookingEvents(), listEvents()]);
  const serializedEvents = events.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    active: e.active,
    kind: "booking" as const,
  }));
  const calendarItems = [
    ...serializedEvents,
    ...jobs.map((job) => ({
      id: job.id,
      name: job.name,
      description: job.companyName,
      startDate: job.startDate.toISOString(),
      endDate: job.endDate.toISOString(),
      active: true,
      kind: "job" as const,
      href: `/invoices/${job.invoiceId}`,
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageBar
        title={t("Bookings")}
        note={t("Review bookings and invoice jobs for the month.")}
        actions={
          <Link href="/bookings/new" className="btn-primary shrink-0">
            <Plus size={15} /> {t("Create event")}
          </Link>
        }
      />

      <BookingEventsCalendar events={calendarItems} />

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("No Booking Events Yet")}
          description={t("Create an event to start taking bookings.")}
          actionHref="/bookings/new"
          actionLabel={t("Create event")}
        />
      ) : (
        <BookingEventListClient events={serializedEvents} />
      )}
    </div>
  );
}
