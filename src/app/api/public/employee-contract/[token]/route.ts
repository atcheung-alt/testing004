import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicEmployeeContractView } from "@/lib/publicEmployeeContract";
import { getClientIp } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { sendDocumentEmail } from "@/lib/mailer";
import { COMPANY } from "@/lib/company";
import { buildEmployeeContractPdf } from "@/lib/pdf/build";
import { contractDocumentTitleFor } from "@/lib/employeeContractTerms";

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const view = await getPublicEmployeeContractView(params.token);
  if (!view) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  return NextResponse.json(view);
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const contract = await prisma.employeeContract.findUnique({
    where: { signingToken: params.token },
    include: { employee: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  if (contract.status === "CANCELLED") {
    return NextResponse.json({ error: "This contract is no longer active." }, { status: 409 });
  }
  if (contract.signedAt) {
    return NextResponse.json({ error: "This contract has already been signed." }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const signerName = typeof body.signerName === "string" ? body.signerName.trim() : "";
  const signatureData = typeof body.signatureData === "string" ? body.signatureData : "";
  const signedDocumentData = typeof body.signedDocumentData === "string" ? body.signedDocumentData : "";
  const signedDocumentName =
    typeof body.signedDocumentName === "string" ? body.signedDocumentName.trim().slice(0, 200) : "";

  const usingUpload = Boolean(signedDocumentData);

  if (!signerName) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
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

  const updated = await prisma.employeeContract.update({
    where: { id: contract.id },
    data: {
      signerName,
      signatureData: usingUpload ? null : signatureData,
      signedDocumentData: usingUpload ? signedDocumentData : null,
      signedDocumentName: usingUpload ? signedDocumentName || "signed-document.pdf" : null,
      signedAt: new Date(),
      signedIp,
      status: "SIGNED",
    },
  });

  await logActivity({
    documentType: "employee",
    documentId: contract.employeeId,
    type: "SIGNED",
    actor: "CLIENT",
    actorName: signerName,
    description: usingUpload
      ? `Contract signed by ${signerName} (uploaded a scanned/printed document)`
      : `Contract signed by ${signerName}`,
  });

  // Best-effort confirmation email to both the employee and HR Plus — a
  // failure here shouldn't block the signature itself from being recorded.
  try {
    const built = await buildEmployeeContractPdf(contract.employeeId);
    if (built) {
      const recipients = [contract.employee.personalEmail || contract.employee.email, COMPANY.email].filter(
        (e, i, arr): e is string => Boolean(e) && arr.indexOf(e) === i
      );
      const documentTitle = contractDocumentTitleFor(contract.employee.employmentType);
      await sendDocumentEmail({
        to: recipients.length ? recipients : COMPANY.email || "",
        subject: `Signed: ${documentTitle} — ${contract.employee.name}`,
        body: `Dear ${signerName},

Thank you for signing your ${documentTitle.toLowerCase()} with ${COMPANY.name}. A copy of the fully signed ${documentTitle.toLowerCase()} is attached for your records. Our team will review it shortly.

Best regards,
${COMPANY.name}`,
        attachment: { filename: `${contract.employee.name.replace(/\s+/g, "-")}-contract-signed.pdf`, content: built.buffer },
        extraAttachments: usingUpload
          ? [
              {
                filename: updated.signedDocumentName || "signed-document.pdf",
                content: Buffer.from(signedDocumentData.split(",")[1] || "", "base64"),
              },
            ]
          : undefined,
        hrSignature: true,
      });
      await logActivity({
        documentType: "employee",
        documentId: contract.employeeId,
        type: "EMAIL_SENT",
        actor: "SYSTEM",
        description: `Signed contract confirmation emailed to ${recipients.join(", ") || COMPANY.email}`,
      });
    }
  } catch (err) {
    console.error("[employee contract sign] confirmation email failed", err);
  }

  return NextResponse.json({ success: true, signedAt: updated.signedAt });
}
