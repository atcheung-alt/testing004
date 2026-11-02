import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus, normalizeInvoiceStatus, isOverdueInvoice } from "@/lib/invoiceStatus";
import StatusBadge from "@/components/StatusBadge";
import StatusUpdater from "@/components/StatusUpdater";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import SendEmailButton from "@/components/SendEmailButton";
import CopySigningLinkButton from "@/components/CopySigningLinkButton";
import VerifyPaymentButton from "@/components/VerifyPaymentButton";
import SyncDriveButton from "@/components/SyncDriveButton";
import DeleteButton from "@/components/DeleteButton";
import DuplicateButton from "@/components/DuplicateButton";
import DocumentItemsTable from "@/components/DocumentItemsTable";
import BackButton from "@/components/BackButton";
import ActivityTimeline from "@/components/ActivityTimeline";
import MarkOnCalendarButton from "@/components/MarkOnCalendarButton";
import { getEventForInvoice } from "@/lib/events";
import { defaultEmailContent, followUpEmailContent, isValidEmail, receiptEmailContent } from "@/lib/settings";
import { COMPANY } from "@/lib/company";
import { ensureInvoiceViewToken, invoiceViewUrlFromHeaders } from "@/lib/signing";
import { withParsedMultipliersList } from "@/lib/multipliers";
import { withParsedFeesList } from "@/lib/fees";
import { getActivityTimeline } from "@/lib/activity";
import { getAppLanguage, getT } from "@/lib/i18n/server";
import { InvoiceExpensesDisclosure } from "@/components/InvoiceExpensesCard";
import { ensureDefaultExpenseCategories } from "@/lib/ensureExpenseCategories";
import { invoiceCanModify, invoiceVisible } from "@/lib/documentAccess";
import { getCurrentUser } from "@/lib/auth";
import { loadColleagues, loadCreatorNickname } from "@/lib/quotationAuthor";
import { colleagueCode, staffCodeFromId } from "@/lib/staffCode";
import { commissionSplitFromStored, isShareHolderNumber } from "@/lib/quotationShares";
import QuotationShareEditor from "@/components/QuotationShareEditor";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const t = getT();
  if (!(await invoiceVisible(params.id))) notFound();
  const canModify = await invoiceCanModify(params.id);
  await ensureDefaultExpenseCategories();
  const [raw, categories, colleagues, invoiceCreator, session] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        expenses: {
          orderBy: { createdAt: "asc" },
          include: {
            documents: {
              select: { id: true, fileName: true, mimeType: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        quotation: {
          select: {
            id: true,
            number: true,
            driveFileUrl: true,
            preparedBy: true,
            shareMode: true,
            total: true,
            shares: { orderBy: { sortOrder: "asc" }, select: { colleagueName: true, value: true } },
          },
        },
        receipt: { select: { id: true, number: true, issueDate: true, driveFileUrl: true } },
      },
    }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true } }),
    loadColleagues(),
    loadCreatorNickname("invoice", params.id),
    getCurrentUser(),
  ]);

  if (!raw) notFound();
  const quoteCreator =
    raw.quotation && !isShareHolderNumber(raw.quotation.number)
      ? await loadCreatorNickname("quotation", raw.quotation.id)
      : "";
  const creatorName = invoiceCreator || quoteCreator || raw.quotation?.preparedBy || "";
  const split = commissionSplitFromStored(
    raw.quotation?.shareMode || "AMOUNT",
    raw.quotation?.shares || [],
    raw.total
  );
  const viewerCode = session ? staffCodeFromId(session.userId) : "";
  const ownPercent = split.partners.reduce(
    (sum, share) => (colleagueCode(share.colleagueName, colleagues) === viewerCode ? sum + share.percent : sum),
    0
  );
  const ownAmount = (split.total * ownPercent) / 100;
  const invoice = { ...raw, items: withParsedFeesList(withParsedMultipliersList(raw.items)) };
  const timeline = await getActivityTimeline("invoice", invoice.id);
  const event = await getEventForInvoice(invoice.id);

  const locked = invoice.status === "CANCELLED";
  const token = await ensureInvoiceViewToken(invoice.id);
  const viewUrl = token ? invoiceViewUrlFromHeaders(token) : null;

  const email = defaultEmailContent({
    kind: "Invoice",
    number: invoice.number,
    title: invoice.title,
    customerName: invoice.customerName,
    companyName: COMPANY.shortName || COMPANY.name,
    language: getAppLanguage(),
  });

  // Only worth offering once the invoice has actually gone out and is still
  // awaiting payment — same gate as "Copy payment link" below, so the two
  // payment-chasing actions appear/disappear together.
  const canFollowUp = invoice.status !== "PAID" && invoice.status !== "DRAFT" && !locked;
  const payerName = invoice.paymentSubmittedName || t("The client");
  const paidOn = invoice.paymentSubmittedAt ? formatDate(invoice.paymentSubmittedAt) : "";
  const payerEmail = invoice.paymentSubmittedEmail || "";
  const paymentNotice =
    paidOn && payerEmail
      ? t(
          "{name} marked this invoice as paid on {date} ({email}). Verify the funds landed, then confirm below — this generates and emails the receipt automatically.",
          { name: payerName, date: paidOn, email: payerEmail }
        )
      : paidOn
      ? t(
          "{name} marked this invoice as paid on {date}. Verify the funds landed, then confirm below — this generates and emails the receipt automatically.",
          { name: payerName, date: paidOn }
        )
      : payerEmail
      ? t(
          "{name} marked this invoice as paid ({email}). Verify the funds landed, then confirm below — this generates and emails the receipt automatically.",
          { name: payerName, email: payerEmail }
        )
      : t(
          "{name} marked this invoice as paid. Verify the funds landed, then confirm below — this generates and emails the receipt automatically.",
          { name: payerName }
        );

  const followUp = followUpEmailContent({
    number: invoice.number,
    title: invoice.title,
    customerName: invoice.customerName,
    companyName: COMPANY.shortName || COMPANY.name,
    dueDate: invoice.dueDate,
    overdue: isOverdueInvoice(invoice),
    language: getAppLanguage(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackButton fallbackHref="/invoices" label={t("All invoices")} />
        <div className="flex flex-wrap items-start justify-between gap-4 mt-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-semibold text-ink">{invoice.number}</h1>
              <StatusBadge status={getInvoiceDisplayStatus(invoice)} />
            </div>
            {invoice.title && (
              <p className="text-sm font-medium text-ink mb-0.5">{invoice.title}</p>
            )}
            <p className="text-sm text-ink-muted">
              <span className="text-brand-600 font-medium">{invoice.customerName}</span>{" "}
              · {t("Issued {date}", { date: formatDate(invoice.issueDate) })}
              {invoice.dueDate ? ` · ${t("Due {date}", { date: formatDate(invoice.dueDate) })}` : ""}
              {invoice.poNumber ? ` · ${t("PO {number}", { number: invoice.poNumber })}` : ""}
            </p>
            {invoice.quotation && (
              <p className="text-sm text-accent-600 mt-1">
                {t("Converted from quotation")}{" "}
                <Link href={`/quotations/${invoice.quotation.id}`} className="underline">
                  {invoice.quotation.number}
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canModify && <StatusUpdater kind="invoice" id={invoice.id} status={normalizeInvoiceStatus(invoice.status)} />}
            <DownloadPdfButton url={`/api/invoices/${invoice.id}/pdf`} />
            <SendEmailButton
              kind="invoices"
              id={invoice.id}
              defaultTo={invoice.customerEmail || ""}
              defaultSubject={email.subject}
              defaultBody={email.body}
              emailValid={isValidEmail(invoice.customerEmail)}
              showCc
            />
            {canFollowUp && (
              <SendEmailButton
                kind="invoices"
                id={invoice.id}
                defaultTo={invoice.customerEmail || ""}
                defaultSubject={followUp.subject}
                defaultBody={followUp.body}
                emailValid={isValidEmail(invoice.customerEmail)}
                showCc
                label={t("Send follow-up email")}
                isFollowUp
              />
            )}
            {viewUrl && invoice.status !== "PAID" && invoice.status !== "DRAFT" && !locked && (
              <CopySigningLinkButton
                url={viewUrl}
                label={t("Copy payment link")}
                title={t("Copy the public view & pay link")}
              />
            )}
            {canModify && (
              <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
                <Pencil size={15} /> {t("Edit")}
              </Link>
            )}
            <DuplicateButton kind="invoice" id={invoice.id} />
            {canModify && <DeleteButton
              url={`/api/invoices/${invoice.id}`}
              confirmNumber={invoice.number}
              itemLabel={t("invoice")}
              redirectTo="/invoices"
            />}
          </div>
        </div>
      </div>

      {invoice.status === "PENDING_VERIFICATION" && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-brand-50/60 border-brand-100">
          <p className="text-sm text-brand-700">{paymentNotice}</p>
          {canModify && <VerifyPaymentButton invoiceId={invoice.id} />}
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
          {t("Billed to")}
        </h2>
        <p className="font-medium text-sm">{invoice.customerName}</p>
        {[
          invoice.customerContact,
          invoice.customerAddress,
          invoice.customerEmail,
          invoice.customerPhone,
        ]
          .filter(Boolean)
          .map((line, i) => (
            <p key={i} className="text-sm text-ink-muted whitespace-pre-line">
              {line}
            </p>
          ))}
      </div>

      <div className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{t("Event")}</h2>
        {invoice.eventStartDate ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              {formatDate(invoice.eventStartDate)}
              {invoice.eventStartTime ? ` ${t("at {time}", { time: invoice.eventStartTime })}` : ""}
              {(invoice.eventEndDate || invoice.eventEndTime) && (
                <>
                  {" "}
                  –{" "}
                  {invoice.eventEndDate ? formatDate(invoice.eventEndDate) : formatDate(invoice.eventStartDate)}
                  {invoice.eventEndTime ? ` ${t("at {time}", { time: invoice.eventEndTime })}` : ""}
                </>
              )}
            </p>
            {invoice.eventEndDate ? (
              <MarkOnCalendarButton invoiceId={invoice.id} markedEventName={event?.name || null} />
            ) : (
              <p className="text-sm text-ink-faint">
                {t("Add an event end date (via Edit) before this can be marked on the calendar.")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            {t("Not set —")}{" "}
            <Link href={`/invoices/${invoice.id}/edit`} className="underline">
              {t("add one from Edit.")}
            </Link>
          </p>
        )}
      </div>

      <QuotationShareEditor
        invoiceId={invoice.id}
        canEdit={canModify}
        creatorName={creatorName}
        commissionTotal={canModify ? split.total : 0}
        ownAmount={ownAmount}
        shares={
          canModify
            ? split.partners.map((share) => ({
                colleagueName: colleagueCode(share.colleagueName, colleagues),
                value: share.percent,
              }))
            : []
        }
        colleagues={canModify ? colleagues : []}
      />

      <DocumentItemsTable
        items={invoice.items}
        subtotal={invoice.subtotal}
        discount={invoice.discount}
        taxRate={invoice.taxRate}
        taxAmount={invoice.taxAmount}
        total={invoice.total}
      />

      <InvoiceExpensesDisclosure
        invoiceId={invoice.id}
        invoiceTotal={invoice.total}
        categories={categories.map((category) => category.name)}
        expenses={invoice.expenses.map((expense) => ({
          id: expense.id,
          category: expense.category,
          label: expense.label,
          amount: expense.amount,
          documents: expense.documents,
        }))}
      />

      {invoice.notes && (
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Notes")}
          </h2>
          <p className="text-sm text-ink whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
          {t("Receipt")}
        </h2>
        {invoice.receipt ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink">
              {invoice.receipt.number} · {t("issued {date}", { date: formatDate(invoice.receipt.issueDate) })}
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <DownloadPdfButton url={`/api/receipts/${invoice.receipt.id}/pdf`} />
              <SendEmailButton
                kind="invoices"
                id={invoice.id}
                endpoint={`/api/receipts/${invoice.receipt.id}/email`}
                defaultTo={invoice.customerEmail || ""}
                defaultSubject={receiptEmailContent({
                  receiptNumber: invoice.receipt.number,
                  invoiceNumber: invoice.number,
                  title: invoice.title,
                  customerName: invoice.customerName,
                  companyName: COMPANY.shortName || COMPANY.name,
                }).subject}
                defaultBody={receiptEmailContent({
                  receiptNumber: invoice.receipt.number,
                  invoiceNumber: invoice.number,
                  title: invoice.title,
                  customerName: invoice.customerName,
                  companyName: COMPANY.shortName || COMPANY.name,
                }).body}
                emailValid={isValidEmail(invoice.customerEmail)}
                showCc
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            {t(
              "No receipt yet — one is generated and emailed to the client automatically once this invoice is verified as Paid."
            )}
          </p>
        )}
      </div>

      {invoice.receipt && (
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Google Drive")}
          </h2>
          <p className="text-sm text-ink-muted mb-2">
            {t(
              "Kept in sync automatically once a receipt is generated — same folder, always the latest version."
            )}
          </p>
          {(invoice.quotation?.driveFileUrl || invoice.driveFileUrl || invoice.receipt?.driveFileUrl) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {invoice.quotation?.driveFileUrl && (
                <a
                  href={invoice.quotation.driveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <ExternalLink size={15} /> {t("Quotation on Drive")}
                </a>
              )}
              {invoice.driveFileUrl && (
                <a
                  href={invoice.driveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <ExternalLink size={15} /> {t("Invoice on Drive")}
                </a>
              )}
              {invoice.receipt?.driveFileUrl && (
                <a
                  href={invoice.receipt.driveFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <ExternalLink size={15} /> {t("Receipt on Drive")}
                </a>
              )}
            </div>
          )}
          <SyncDriveButton invoiceId={invoice.id} />
        </div>
      )}

      {invoice.signatureData && (
        <div className="card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {t("Authorized signature")}
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={invoice.signatureData}
            alt={t("Authorized signature")}
            className="max-h-24 bg-white rounded-lg border border-line"
          />
          {invoice.signatureName && (
            <p className="mt-2 text-sm text-ink">{t("Name: {name}", { name: invoice.signatureName })}</p>
          )}
          {invoice.signedAt && (
            <p className="text-xs text-ink-faint">{t("Signed {date}", { date: formatDate(invoice.signedAt) })}</p>
          )}
        </div>
      )}

      <ActivityTimeline events={timeline} />
    </div>
  );
}
