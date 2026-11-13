import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicRecruitmentView } from "@/lib/publicRecruitment";
import { getClientIp } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { sendDocumentEmail } from "@/lib/mailer";
import { creatorCopy } from "@/lib/recordFiles";
import { COMPANY } from "@/lib/company";
import { buildRecruitmentAgreementPdf } from "@/lib/pdf/build";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const view = await getPublicRecruitmentView(params.token);
  if (!view) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  return NextResponse.json(view);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const agreement = await prisma.recruitmentAgreement.findUnique({
    where: { signingToken: params.token },
  });
  if (!agreement) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  if (agreement.status === "CANCELLED") {
    return NextResponse.json({ error: "This agreement is no longer active." }, { status: 409 });
  }
  if (agreement.signedAt) {
    return NextResponse.json({ error: "This agreement has already been signed." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const signerCompanyName = typeof body.signerCompanyName === "string" ? body.signerCompanyName.trim() : "";
  const signerJobTitle = typeof body.signerJobTitle === "string" ? body.signerJobTitle.trim() : "";
  const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
  const signedDocumentData = typeof body.signedDocumentData === "string" ? body.signedDocumentData : "";
  const signedDocumentName =
    typeof body.signedDocumentName === "string" ? body.signedDocumentName.trim().slice(0, 200) : "";

  const usingUpload = Boolean(signedDocumentData);

  if (!signerName) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }
  if (!signerCompanyName) {
    return NextResponse.json({ error: "Please enter your company name." }, { status: 400 });
  }
  if (!signerJobTitle) {
    return NextResponse.json({ error: "Please enter your job title." }, { status: 400 });
  }
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
    return NextResponse.json({ error: "Please provide a signature before submitting." }, { status: 400 });
  }

  const signedIp = getClientIp(request);

  const updated = await prisma.recruitmentAgreement.update({
    where: { id: agreement.id },
    data: {
      signerName,
      signerCompanyName,
      signerJobTitle,
      signatureData: usingUpload ? null : signatureData,
      signedDocumentData: usingUpload ? signedDocumentData : null,
      signedDocumentName: usingUpload ? signedDocumentName || "signed-document.pdf" : null,
      signedAt: new Date(),
      signedIp,
      status: "SIGNED",
    },
  });

  await logActivity({
    documentType: "recruitment",
    documentId: updated.id,
    type: "SIGNED",
    actor: "CLIENT",
    actorName: signerName,
    description: usingUpload
      ? `Signed by ${signerName} (${signerJobTitle}, ${signerCompanyName}) — uploaded a scanned/printed document`
      : `Signed by ${signerName} (${signerJobTitle}, ${signerCompanyName})`,
  });

  // Best-effort confirmation email to both the client and HR Plus — a
  // failure here shouldn't block the signature itself from being recorded.
  try {
    const built = await buildRecruitmentAgreementPdf(agreement.id);
    if (built) {
      const recipients = [agreement.companyEmail, COMPANY.email].filter(
        (e, i, arr) => e && arr.indexOf(e) === i
      );
      await sendDocumentEmail({
        to: recipients.length ? recipients : COMPANY.email || "",
        cc: creatorCopy(agreement.createdByEmail, recipients),
        subject: `Signed: Recruitment Agreement ${updated.number}`,
        body: `Dear ${signerName},

Thank you for signing the Recruitment Services Agreement (${updated.number}) with ${COMPANY.name}. A copy of the fully signed agreement is attached for your records.

Best regards,
${COMPANY.name}`,
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
        documentType: "recruitment",
        documentId: updated.id,
        type: "EMAIL_SENT",
        actor: "SYSTEM",
        description: `Signed confirmation emailed to ${recipients.join(", ") || COMPANY.email}`,
      });
    }
  } catch (err) {
    console.error("[recruitment sign] confirmation email failed", err);
  }

  return NextResponse.json({ success: true, signedAt: updated.signedAt });
}
