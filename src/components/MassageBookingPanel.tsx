import Link from "next/link";
import QRCode from "qrcode";
import { getT } from "@/lib/i18n/server";
import {
  getMassageBookingLink,
  listMassageInvoiceOptions,
  massageSurveyUrlFromHeaders,
  mentionsMassage,
} from "@/lib/massage";
import MassageQrActions from "@/components/MassageQrActions";
import {
  EnableMassageQuestionnaireButton,
  MassageInvoiceField,
} from "@/components/MassageQuestionnaireControls";

export default async function MassageBookingPanel({
  bookingEventId,
  eventName,
  description,
}: {
  bookingEventId: string;
  eventName: string;
  description: string;
}) {
  const t = getT();
  const massageDay = mentionsMassage(eventName) || mentionsMassage(description);
  const link = await getMassageBookingLink(bookingEventId, massageDay);

  if (!link) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">{t("Guest Questionnaire")}</h2>
        <p className="text-sm text-ink-muted mt-1 mb-4">
          {t("Create the QR code on this event. Guests can scan it on the day, before you write the invoice.")}
        </p>
        <EnableMassageQuestionnaireButton bookingEventId={bookingEventId} />
      </section>
    );
  }

  const url = massageSurveyUrlFromHeaders(link.token);
  const [invoices, pngDataUrl, qrSvg] = await Promise.all([
    listMassageInvoiceOptions(),
    QRCode.toDataURL(url, { margin: 1, width: 480, errorCorrectionLevel: "M" }),
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
  ]);

  return (
    <section className="card p-5 sm:p-6 grid gap-6 lg:grid-cols-[180px_1fr] lg:items-start">
      <div
        className="w-[180px] h-[180px] bg-white rounded-xl [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <div className="flex flex-col gap-4 min-w-0">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("Guest Questionnaire")}</h2>
          <p className="text-sm text-ink-muted mt-1">
            {t("Scores stay on this event. Attach the invoice after the massage, when you bill the client.")}
          </p>
          <p className="text-sm mt-2">
            <Link href={`/massage/${bookingEventId}`} className="text-brand-600 hover:underline">
              {t("Open scores for this event")}
            </Link>
          </p>
        </div>
        <MassageQrActions url={url} pngDataUrl={pngDataUrl} />
        <MassageInvoiceField
          bookingEventId={bookingEventId}
          invoices={invoices}
          currentId={link.invoiceId}
        />
      </div>
    </section>
  );
}
