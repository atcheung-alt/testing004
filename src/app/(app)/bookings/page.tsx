import Link from "next/link";
import { Plus, CalendarCheck } from "lucide-react";
import { listBookingEvents } from "@/lib/bookings";
import { companyWhere, rowInCompanyScope } from "@/lib/access";
import { listEvents } from "@/lib/events";
import EmptyState from "@/components/EmptyState";
import BookingEventListClient from "@/components/BookingEventListClient";
import BookingEventsCalendar from "@/components/BookingEventsCalendar";
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
  const scope = await companyWhere();

  const [events, jobs] = await Promise.all([listBookingEvents(), listEvents()]);
  const ownEvents = events.filter((event) => rowInCompanyScope(scope, event.companyId));
  const ownJobs = jobs.filter((job) => rowInCompanyScope(scope, job.companyId));
  const serializedEvents = ownEvents.map((e) => ({
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
    ...ownJobs.map((job) => ({
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Bookings")}</h1>
          <p className="text-sm text-ink-muted">
            {t("Coloured bars are bookings. Grey bars are jobs marked from an invoice.")}
          </p>
        </div>
        <Link href="/bookings/new" className="btn-primary shrink-0">
          <Plus size={15} /> {t("New event")}
        </Link>
      </div>

      <BookingEventsCalendar events={calendarItems} />

      {ownEvents.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={t("No booking events yet")}
          description={t("Create your first event to start taking bookings.")}
          actionHref="/bookings/new"
          actionLabel={t("New event")}
        />
      ) : (
        <BookingEventListClient events={serializedEvents} />
      )}
    </div>
  );
}
