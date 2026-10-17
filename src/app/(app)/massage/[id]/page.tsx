import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/calculations";
import { getT } from "@/lib/i18n/server";
import { getMassageCalendarEvent, massageSurveyUrlFromHeaders, surveyScore, therapistStandings } from "@/lib/massage";
import MassageLeaderboard from "@/components/MassageLeaderboard";
import MassageQrActions from "@/components/MassageQrActions";

export const dynamic = "force-dynamic";

export default async function MassageEventPage({ params }: { params: { id: string } }) {
  const t = getT();
  const found = await getMassageCalendarEvent(params.id);
  if (!found) notFound();
  const { event, invoice, token } = found;

  const url = massageSurveyUrlFromHeaders(token);
  const [standings, surveys, pngDataUrl, qrSvg] = await Promise.all([
    therapistStandings(invoice.id),
    prisma.massageSurvey.findMany({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: "desc" },
      include: { therapist: { select: { name: true } } },
    }),
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }),
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
  ]);
  const sameDay = formatDate(event.startDate) === formatDate(event.endDate);
  const when = sameDay ? formatDate(event.startDate) : `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
  const eventScore =
    surveys.length > 0
      ? surveyScore({
          overall: surveys.reduce((sum, row) => sum + row.overall, 0) / surveys.length,
          focus: surveys.reduce((sum, row) => sum + row.focus, 0) / surveys.length,
          pressure: surveys.reduce((sum, row) => sum + row.pressure, 0) / surveys.length,
          relief: surveys.reduce((sum, row) => sum + row.relief, 0) / surveys.length,
        })
      : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/massage" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-3">
          <ArrowLeft size={16} />
          {t("Back to ranking")}
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">{t("This event")}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="text-sm text-ink-muted mt-2">
          <Link href={`/invoices/${invoice.id}`} className="hover:text-brand-600">
            {invoice.number}
          </Link>
          {invoice.customerName ? ` · ${invoice.customerName}` : ""}
          {` · ${when}`}
          {surveys.length > 0 ? ` · ${t("Event average")} ${eventScore.toFixed(1)}` : ""}
        </p>
      </div>

      <section className="card p-5 sm:p-6 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
        <div
          className="w-[220px] h-[220px] bg-white rounded-xl [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div>
          <h2 className="font-display text-xl font-semibold">{t("Guest questionnaire")}</h2>
          <p className="text-sm text-ink-muted mt-1 mb-4">
            {t("Guests scan this after the massage. It takes about half a minute.")}
          </p>
          <MassageQrActions url={url} pngDataUrl={pngDataUrl} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">{t("Therapists at this event")}</h2>
        <MassageLeaderboard rows={standings} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">{t("Survey records")}</h2>
        {surveys.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <h3 className="font-display text-lg font-semibold mb-1">{t("No surveys for this event yet")}</h3>
            <p className="text-sm text-ink-muted">{t("Scores appear here after a guest submits the form.")}</p>
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {surveys.map((survey) => (
              <article key={survey.id} className="px-4 sm:px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{survey.therapist.name}</h3>
                  <p className="font-mono text-lg text-brand-700">
                    {surveyScore(survey).toFixed(1)}
                  </p>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(survey.createdAt)}</p>
                <p className="text-sm text-ink mt-2">
                  {t("Overall")} {survey.overall} · {t("Care")} {survey.focus} · {t("Pressure")} {survey.pressure} ·{" "}
                  {t("Relief")} {survey.relief}
                </p>
                {survey.comment && <p className="text-sm text-ink-muted mt-2">{survey.comment}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
