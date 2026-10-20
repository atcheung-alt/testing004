import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ExternalLink, FileDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatDate } from "@/lib/calculations";
import { isValidEmail } from "@/lib/settings";
import { ensureRecruitmentSigningToken, recruitmentSigningUrlFromHeaders } from "@/lib/signing";
import { getActivityTimeline } from "@/lib/activity";
import { COMPANY } from "@/lib/company";
import StatusBadge from "@/components/StatusBadge";
import StatusUpdater from "@/components/StatusUpdater";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import SendEmailButton from "@/components/SendEmailButton";
import CopySigningLinkButton from "@/components/CopySigningLinkButton";
import DeleteButton from "@/components/DeleteButton";
import ActivityTimeline from "@/components/ActivityTimeline";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RecruitmentDetailPage({ params }: { params: { id: string } }) {
  const t = getT();
  const agreement = await prisma.recruitmentAgreement.findUnique({ where: { id: params.id } });
  if (!agreement) notFound();

  const locked = agreement.status === "CANCELLED";
  const token = await ensureRecruitmentSigningToken(agreement.id);
  const signingUrl = token ? recruitmentSigningUrlFromHeaders(token) : null;
  const timeline = await getActivityTimeline("recruitment", agreement.id);

  const emailSubject = t("Recruitment Services Agreement {number} from {company}", {
    number: agreement.number,
    company: COMPANY.name,
  });
  const emailBody = t(
    "Dear {company},\n\nPlease find attached our Recruitment Services Agreement ({number}) for your review.\n\nTo review and sign online, please use the \"Review & Sign Online\" link below — no login required.\n\nBest regards,\n{sender}",
    { company: agreement.companyName, number: agreement.number, sender: COMPANY.name }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{agreement.number}</h1>
            <StatusBadge status={agreement.status} />
          </div>
          <p className="text-sm text-ink-muted">{agreement.companyName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusUpdater kind="recruitment" id={agreement.id} status={agreement.status} disabled={locked} />
          <DownloadPdfButton url={`/api/recruitment/${agreement.id}/pdf`} />
          <SendEmailButton
            kind="recruitment"
            id={agreement.id}
            defaultTo={agreement.companyEmail}
            defaultSubject={emailSubject}
            defaultBody={emailBody}
            emailValid={isValidEmail(agreement.companyEmail)}
            showCc
          />
          {signingUrl && agreement.status !== "SIGNED" && !locked && (
            <CopySigningLinkButton
              url={signingUrl}
              label={t("Copy signing link")}
              title={t("Copy the public review & sign link")}
            />
          )}
          {!locked && (
            <Link href={`/recruitment/${agreement.id}/edit`} className="btn-secondary">
              <Pencil size={15} /> {t("Edit")}
            </Link>
          )}
          <DeleteButton
            url={`/api/recruitment/${agreement.id}`}
            confirmNumber={agreement.number}
            itemLabel={t("recruitment agreement")}
            redirectTo="/recruitment"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Company email")}
          </p>
          <p className="text-sm text-ink">{agreement.companyEmail}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Payment terms")}
          </p>
          <p className="text-sm text-ink">{t("Net {days} days", { days: agreement.paymentDueDays })}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Agreement date")}</p>
          <p className="text-sm text-ink">{formatDate(agreement.createdAt)}</p>
        </div>
      </div>

      {agreement.signedAt && (
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Signed by client")}
          </h2>
          {agreement.signedDocumentData ? (
            <a href={`/api/recruitment/${agreement.id}/signed-document`} className="btn-secondary">
              <FileDown size={15} />
              {t("Download {name}", { name: agreement.signedDocumentName || t("signed document") })}
            </a>
          ) : (
            agreement.signatureData && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agreement.signatureData}
                alt={t("Client signature")}
                className="max-h-24 bg-white rounded-lg border border-line mb-2"
              />
            )
          )}
          <p className="mt-2 text-sm text-ink">
            {agreement.signerName} — {agreement.signerJobTitle}, {agreement.signerCompanyName}
          </p>
          <p className="text-xs text-ink-faint">
            {formatDateTime(agreement.signedAt)}
            {agreement.signedIp ? ` · ${t("IP {ip}", { ip: agreement.signedIp })}` : ""}
            {agreement.signedDocumentData ? ` · ${t("uploaded a scanned/printed document")}` : ""}
          </p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">{t("Terms of Business")}</h2>
          {signingUrl && (
            <Link href={signingUrl} target="_blank" className="text-sm text-brand-500 hover:underline flex items-center gap-1">
              {t("View public signing page")} <ExternalLink size={13} />
            </Link>
          )}
        </div>
        <p className="text-sm text-ink whitespace-pre-line max-h-[600px] overflow-y-auto">
          {agreement.terms}
        </p>
      </div>

      <ActivityTimeline events={timeline} />
    </div>
  );
}
