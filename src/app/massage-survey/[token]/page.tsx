import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { getT } from "@/lib/i18n/server";
import { ensureMassageTables, ensureMassageTherapists } from "@/lib/massage";
import { getBookingEvent } from "@/lib/bookings";
import PublicBookingShell from "@/components/PublicBookingShell";
import MassageSurveyForm from "@/components/MassageSurveyForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t("Session feedback") };
}

export default async function MassageSurveyPage({ params }: { params: { token: string } }) {
  await ensureMassageTables();
  const link = await prisma.massageEventLink.findUnique({
    where: { token: params.token },
    select: {
      bookingEventId: true,
      invoice: { select: { title: true, customerName: true } },
    },
  });
  if (!link) notFound();
  const booking = link.bookingEventId ? await getBookingEvent(link.bookingEventId) : null;

  await ensureMassageTherapists();
  const [therapists, company] = await Promise.all([
    prisma.massageTherapist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getEffectiveCompany(),
  ]);

  const eventName = booking?.name || link.invoice?.title || link.invoice?.customerName;

  return (
    <PublicBookingShell
      company={{
        name: company.name,
        shortName: company.shortName,
        logoData: company.logoData,
        logoDataDark: company.logoDataDark,
      }}
    >
      <div className="max-w-xl mx-auto">
        <MassageSurveyForm
          token={params.token}
          therapists={therapists}
          eventName={eventName || ""}
        />
      </div>
    </PublicBookingShell>
  );
}
