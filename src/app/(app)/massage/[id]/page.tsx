import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/calculations";
import { getT } from "@/lib/i18n/server";
import {
  ensureMassageTherapists,
  getMassageEventView,
  listMassageInvoiceOptions,
  massageSurveyUrlFromHeaders,
  surveyScore,
  unpackSurveyNote,
  therapistStandings,
} from "@/lib/massage";
import MassageLeaderboard from "@/components/MassageLeaderboard";
import MassageQrActions from "@/components/MassageQrActions";
import MassageSurveyRecords from "@/components/MassageSurveyRecords";
import { MassageInvoiceField } from "@/components/MassageQuestionnaireControls";

export const dynamic = "force-dynamic";

export default async function MassageEventPage({ params }: { params: { id: string } }) {
  const t = getT();
  const event = await getMassageEventView(params.id);
  if (!event) notFound();

  const url = massageSurveyUrlFromHeaders(event.token);
  await ensureMassageTherapists();
  const [standings, surveys, invoices, pngDataUrl, qrSvg, therapists] = await Promise.all([
    therapistStandings(event.linkId),
    prisma.massageSurvey.findMany({
      where: { linkId: event.linkId },
      orderBy: { createdAt: "desc" },
      include: { therapist: { select: { name: true } } },
    }),
    event.bookingEventId ? listMassageInvoiceOptions() : Promise.resolve([]),
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }),
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    prisma.massageTherapist.findMany({
      where: {
        OR: [{ active: true }, { surveys: { some: { linkId: event.linkId } } }],
      },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
      select: { id: true, name: true },
    }),
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
          {t("Back to results")}
        </Link>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 mb-1">{t("This event")}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="text-sm text-ink-muted mt-2">
          {event.bookingEventId ? (
            <Link href={`/bookings/${event.bookingEventId}`} className="hover:text-brand-600">
              {t("Open booking")}
            </Link>
          ) : null}
          {event.invoice ? (
            <>
              {event.bookingEventId ? " · " : null}
              <Link href={`/invoices/${event.invoice.id}`} className="hover:text-brand-600">
                {event.invoice.number}
              </Link>
            </>
          ) : (
            <>
              {event.bookingEventId ? " · " : null}
              {t("Invoice not attached yet")}
            </>
          )}
          {event.companyName ? ` · ${event.companyName}` : ""}
          {` · ${when}`}
          {surveys.length > 0 ? ` · ${t("Event average")} ${eventScore.toFixed(1)}` : ""}
        </p>
      </div>

      <section className="card p-5 sm:p-6 grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
        <div
          className="w-[220px] h-[220px] bg-white rounded-xl [&_svg]:h-full [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{t("Guest Questionnaire")}</h2>
            <p className="text-sm text-ink-muted mt-1">
              {t("Guests scan this after the massage. It takes about half a minute.")}
            </p>
          </div>
          <MassageQrActions url={url} pngDataUrl={pngDataUrl} />
          {event.bookingEventId ? (
            <MassageInvoiceField
              bookingEventId={event.bookingEventId}
              invoices={invoices}
              currentId={event.invoice?.id ?? null}
            />
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">{t("Scores at This Event")}</h2>
        <MassageLeaderboard
          rows={standings}
          notes={surveys.map((survey) => {
            const note = unpackSurveyNote(survey.comment);
            return {
              id: survey.id,
              therapistId: survey.therapistId,
              guestNickname: note.guestNickname,
              timeSlot: note.timeSlot,
              comment: note.comment,
              when: formatDateTime(survey.createdAt),
            };
          })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">{t("Survey Records")}</h2>
        {surveys.length === 0 ? (
          <div className="card px-5 py-10 text-center">
            <h3 className="font-display text-lg font-semibold mb-1">{t("No Surveys for This Event Yet")}</h3>
            <p className="text-sm text-ink-muted">{t("Scores appear here after a guest submits the form.")}</p>
          </div>
        ) : (
          <MassageSurveyRecords
            therapists={therapists}
            surveys={surveys.map((survey) => {
              const note = unpackSurveyNote(survey.comment);
              return {
              id: survey.id,
              therapistId: survey.therapistId,
              therapistName: survey.therapist.name,
              guestNickname: note.guestNickname,
              timeSlot: note.timeSlot,
              overall: survey.overall,
              focus: survey.focus,
              pressure: survey.pressure,
              relief: survey.relief,
              comment: note.comment,
              when: formatDateTime(survey.createdAt),
              score: surveyScore(survey).toFixed(1),
              };
            })}
          />
        )}
      </section>
    </div>
  );
}
