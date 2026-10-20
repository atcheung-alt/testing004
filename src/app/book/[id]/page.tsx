import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveCompany } from "@/lib/appSettings";
import { getBookingEvent } from "@/lib/bookings";
import PublicEventBookingClient from "@/components/PublicEventBookingClient";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = getT();
  const event = await getBookingEvent(params.id);
  return { title: event ? t("Book: {name}", { name: event.name }) : t("Book an Appointment") };
}

/**
 * A single bookable event's own public page — the per-event booking flow
 * (see the schema comment on BookingEvent for why this replaced one generic
 * /book form). Not indexed under a per-client token; anyone with the link
 * can book, same public-form stance the old /book page had.
 */
export default async function BookEventPage({ params }: { params: { id: string } }) {
  const [event, company] = await Promise.all([getBookingEvent(params.id), getEffectiveCompany()]);
  if (!event || !event.active) notFound();

  return (
    <PublicEventBookingClient
      event={{
        id: event.id,
        name: event.name,
        companyName: event.companyName,
        description: event.description,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        requiresConfirmation: event.requiresConfirmation,
      }}
      company={{
        name: company.name,
        shortName: company.shortName,
        logoData: company.logoData,
        logoDataDark: company.logoDataDark,
      }}
    />
  );
}
