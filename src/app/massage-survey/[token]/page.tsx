import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { getT } from "@/lib/i18n/server";
import { ensureMassageTherapists } from "@/lib/massage";
import PublicBookingShell from "@/components/PublicBookingShell";
import MassageSurveyForm from "@/components/MassageSurveyForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t("How was your massage?") };
}

export default async function MassageSurveyPage({ params }: { params: { token: string } }) {
  const t = getT();
  const link = await prisma.massageEventLink.findUnique({
    where: { token: params.token },
    select: { invoice: { select: { id: true, title: true, customerName: true } } },
  });
  if (!link) notFound();
  const invoice = link.invoice;

  await ensureMassageTherapists();
  const [therapists, company] = await Promise.all([
    prisma.massageTherapist.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getEffectiveCompany(),
  ]);

  const eventName = invoice.title || invoice.customerName;

  return (
    <PublicBookingShell
      company={{
        name: company.name,
        shortName: company.shortName,
        logoData: company.logoData,
        logoDataDark: company.logoDataDark,
      }}
    >
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("How was your massage?")}</h1>
        {eventName && <p className="text-sm text-ink-muted mt-2">{eventName}</p>}
        <p className="text-sm text-ink-muted mt-1 mb-6">
          {t("About 30 seconds. Pick your therapist, tap a score from 1 to 5, and send.")}
        </p>
        <MassageSurveyForm token={params.token} therapists={therapists} />
      </div>
    </PublicBookingShell>
  );
}
