import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { isValidEmail, signedNotificationEmailContent, newInvoiceEmailContent } from "@/lib/settings";
import { getClientIp, ensureInvoiceViewToken, invoiceViewUrlFor } from "@/lib/signing";
import { getPublicQuotationView } from "@/lib/publicQuotation";
import { buildQuotationPdf, buildInvoicePdf } from "@/lib/pdf/build";
import { sendDocumentEmail } from "@/lib/mailer";
import { creatorCopy } from "@/lib/recordFiles";
import { convertQuotationToInvoice } from "@/lib/quotationToInvoice";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

/**
 * Public, token-scoped quotation lookup for the /sign/[token] page. No
 * authentication — the random signing token itself is the access control.
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const view = await getPublicQuotationView(params.token);
  if (!view) {
    return NextResponse.json(
      { error: "This signing link is invalid or has expired." },
      { status: 404 }
    );
  }
  return NextResponse.json(view);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const body = await request.json().catch(() => ({}));

  const quotation = await prisma.quotation.findUnique({ where: { signingToken: params.token } });
  if (!quotation) {
    return NextResponse.json(
      { error: "This signing link is invalid or has expired." },
      { status: 404 }
    );
  }
  if (quotation.signedAt) {
    return NextResponse.json(
      { error: "This quotation has already been signed and cannot be signed again." },
      { status: 409 }
    );
  }
  if (quotation.status === "CONVERTED") {
    return NextResponse.json(
      { error: "This quotation is locked and can no longer be signed." },
      { status: 409 }
    );
  }

  const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
  const signedDocumentData = typeof body.signedDocumentData === "string" ? body.signedDocumentData : "";
  const signedDocumentName =
    typeof body.signedDocumentName === "string" ? body.signedDocumentName.trim().slice(0, 200) : "";
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const signerEmail = typeof body.signerEmail === "string" ? body.signerEmail.trim() : "";

  const usingUpload = Boolean(signedDocumentData);

  if (!signatureData && !signedDocumentData) {
    return NextResponse.json(
      { error: "Please draw your signature or upload a signed PDF before submitting." },
      { status: 400 }
    );
  }
  if (usingUpload) {
    if (!signedDocumentData.startsWith("data:application/pdf")) {
      return NextResponse.json(
        { error: "The uploaded document must be a PDF file." },
        { status: 400 }
      );
    }
    // Roughly bound the decoded file size (base64 inflates size ~4/3) —
    // this is stored inline as a database column, not on disk, so a huge
    // upload isn't just slow, it bloats every future read of this row.
    const approxBytes = (signedDocumentData.length * 3) / 4;
    if (approxBytes > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "That PDF is too large — please keep it under 15 MB." },
        { status: 400 }
      );
    }
  } else if (!signatureData.startsWith("data:image")) {
    return NextResponse.json(
      { error: "Please provide a signature before submitting." },
      { status: 400 }
    );
  }
  if (!signerName) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!isValidEmail(signerEmail)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const signedIp = getClientIp(request);

  const updated = await prisma.quotation.update({
    where: { id: quotation.id },
    data: {
      signatureData: usingUpload ? null : signatureData,
      signedDocumentData: usingUpload ? signedDocumentData : null,
      signedDocumentName: usingUpload ? signedDocumentName || "signed-document.pdf" : null,
      signerName,
      signerEmail,
      signedAt: new Date(),
      signedIp,
      status: "ACCEPTED",
    },
  });

  await logActivity({
    documentType: "quotation",
    documentId: updated.id,
    type: "SIGNED",
    actor: "CLIENT",
    actorName: signerName,
    description: usingUpload
      ? `Signed by ${signerName} (uploaded a scanned/printed document)`
      : `Signed by ${signerName}`,
  });

  // Regenerate the PDF (now embeds the signature) and email it to both the
  // client and HR Plus. Signing itself has already succeeded at this point —
  // an email hiccup is reported back but doesn't undo the signature.
  let emailWarning: string | null = null;
  try {
    const built = await buildQuotationPdf(updated.id);
    if (built) {
      const { subject, body: emailBody } = signedNotificationEmailContent({
        number: updated.number,
        title: updated.title,
        customerName: updated.customerName,
        signerName,
        companyName: COMPANY.shortName || COMPANY.name,
      });

      const recipients = [updated.customerEmail, signerEmail].filter(
        (e, i, arr) => e && isValidEmail(e) && arr.indexOf(e) === i
      ) as string[];

      await sendDocumentEmail({
        to: recipients.length ? recipients : COMPANY.email || "",
        cc: creatorCopy(updated.createdByEmail, recipients),
        subject,
        body: emailBody,
        attachment: { filename: `${updated.number}-signed.pdf`, content: built.buffer },
        extraAttachments: usingUpload
          ? [
              {
                filename: updated.signedDocumentName || `${updated.number}-signed-document.pdf`,
                content: Buffer.from(signedDocumentData.split(",")[1] || "", "base64"),
              },
            ]
          : undefined,
      });
      await logActivity({
        documentType: "quotation",
        documentId: updated.id,
        type: "EMAIL_SENT",
        actor: "SYSTEM",
        description: `Signed confirmation emailed to ${recipients.join(", ") || COMPANY.email}`,
      });
    }
  } catch (err: any) {
    emailWarning =
      err?.message || "The signature was saved, but the confirmation email could not be sent.";
  }

  // Accepting a quotation automatically generates its invoice and emails the
  // client a "View & Pay Invoice Online" link — mirroring how the quotation
  // itself was sent. Failures here are reported back but never undo the
  // signature that already succeeded above.
  let invoiceNumber: string | null = null;
  let invoiceEmailWarning: string | null = null;
  try {
    const invoice = await convertQuotationToInvoice(updated.id);
    invoiceNumber = invoice.number;

    const invoiceToken = await ensureInvoiceViewToken(invoice.id);
    const built = await buildInvoicePdf(invoice.id);
    if (built && invoiceToken) {
      const { subject, body: emailBody } = newInvoiceEmailContent({
        number: invoice.number,
        title: invoice.title,
        customerName: invoice.customerName,
        companyName: COMPANY.shortName || COMPANY.name,
        quotationNumber: updated.number,
      });

      const recipients = [invoice.customerEmail, signerEmail].filter(
        (e, i, arr) => e && isValidEmail(e) && arr.indexOf(e) === i
      ) as string[];

      await sendDocumentEmail({
        to: recipients.length ? recipients : COMPANY.email || "",
        cc: creatorCopy(updated.createdByEmail, recipients),
        subject,
        body: emailBody,
        attachment: { filename: `${invoice.number}.pdf`, content: built.buffer },
        signingUrl: invoiceViewUrlFor(invoiceToken, request),
        ctaLabel: "View & Pay Invoice Online",
      });
      await logActivity({
        documentType: "invoice",
        documentId: invoice.id,
        type: "EMAIL_SENT",
        actor: "SYSTEM",
        description: `Invoice emailed to ${recipients.join(", ") || COMPANY.email}`,
      });
    }
  } catch (err: any) {
    invoiceEmailWarning = err?.message || "The invoice could not be generated automatically.";
  }

  return NextResponse.json({
    success: true,
    number: updated.number,
    signerName,
    signedAt: updated.signedAt,
    emailWarning,
    invoiceNumber,
    invoiceEmailWarning,
  });
}
