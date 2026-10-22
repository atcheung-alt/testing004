import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onboardingSubmissionFieldsFrom } from "@/lib/employees";
import { logActivity } from "@/lib/activity";
import { getPublicEmployeeOnboardingView } from "@/lib/publicEmployeeOnboarding";
import { isDriveConfigured } from "@/lib/googleDrive";
import { uploadEmployeeOnboardingDocument } from "@/lib/driveSync";
import { parseDataUrl } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/** "application/pdf" -> "pdf", "image/jpeg" -> "jpg", etc. — for the Drive
 *  file's own name/extension. Falls back to the second half of the MIME type
 *  in the unlikely case a new type gets allowlisted here without updating
 *  this map. */
function extensionForContentType(contentType: string): string {
  const map: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
  return map[contentType] || contentType.split("/")[1] || "bin";
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const employee = await prisma.employee.findUnique({
    where: { onboardingToken: params.token },
    select: { id: true, onboardingCompletedAt: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  // The one real lock in this feature: once submitted, never again — no
  // resubmission, no editing back in through this link. Matches the
  // already-signed/already-paid lock on the quotation/invoice/recruitment
  // public pages.
  if (employee.onboardingCompletedAt) {
    return NextResponse.json(
      { error: "This onboarding form has already been submitted." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const fields = onboardingSubmissionFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const { error, addressProofData, bankStatementData, hkidDocumentData, ...data } = fields;
  const documentsAlreadyUploaded = body.documentsAlreadyUploaded === true;

  // Documents are a mandatory part of onboarding (see onboardingSubmissionFieldsFrom),
  // so — unlike every other Drive sync in this app — a failure here must be a
  // real error back to the employee, not a silently-swallowed warning.
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Document storage isn't configured yet. Please contact HR before submitting." },
      { status: 503 }
    );
  }

  let uploaded: {
    addressProofDriveFileId: string;
    addressProofDriveUrl: string;
    bankStatementDriveFileId: string;
    bankStatementDriveUrl: string;
    hkidDocumentDriveFileId: string;
    hkidDocumentDriveUrl: string;
  } | null = null;

  if (documentsAlreadyUploaded) {
    const stored = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: {
        addressProofDriveFileId: true,
        addressProofDriveUrl: true,
        bankStatementDriveFileId: true,
        bankStatementDriveUrl: true,
        hkidDocumentDriveFileId: true,
        hkidDocumentDriveUrl: true,
      },
    });
    if (
      !stored?.addressProofDriveFileId ||
      !stored.addressProofDriveUrl ||
      !stored.bankStatementDriveFileId ||
      !stored.bankStatementDriveUrl ||
      !stored.hkidDocumentDriveFileId ||
      !stored.hkidDocumentDriveUrl
    ) {
      return NextResponse.json(
        { error: "Please attach all three documents before submitting." },
        { status: 400 }
      );
    }
    uploaded = {
      addressProofDriveFileId: stored.addressProofDriveFileId,
      addressProofDriveUrl: stored.addressProofDriveUrl,
      bankStatementDriveFileId: stored.bankStatementDriveFileId,
      bankStatementDriveUrl: stored.bankStatementDriveUrl,
      hkidDocumentDriveFileId: stored.hkidDocumentDriveFileId,
      hkidDocumentDriveUrl: stored.hkidDocumentDriveUrl,
    };
  } else {
    try {
      const addressProofParsed = parseDataUrl(addressProofData)!;
      const bankStatementParsed = parseDataUrl(bankStatementData)!;
      const hkidDocumentParsed = parseDataUrl(hkidDocumentData)!;
      const [addressProofFile, bankStatementFile, hkidDocumentFile] = await Promise.all([
        uploadEmployeeOnboardingDocument(
          employee.id,
          "Proof of Address",
          extensionForContentType(addressProofParsed.contentType),
          addressProofParsed.buffer
        ),
        uploadEmployeeOnboardingDocument(
          employee.id,
          "Bank Statement",
          extensionForContentType(bankStatementParsed.contentType),
          bankStatementParsed.buffer
        ),
        uploadEmployeeOnboardingDocument(
          employee.id,
          "HKID",
          extensionForContentType(hkidDocumentParsed.contentType),
          hkidDocumentParsed.buffer
        ),
      ]);
      uploaded = {
        addressProofDriveFileId: addressProofFile.id,
        addressProofDriveUrl: addressProofFile.webViewLink,
        bankStatementDriveFileId: bankStatementFile.id,
        bankStatementDriveUrl: bankStatementFile.webViewLink,
        hkidDocumentDriveFileId: hkidDocumentFile.id,
        hkidDocumentDriveUrl: hkidDocumentFile.webViewLink,
      };
    } catch (err: any) {
      console.error("Failed to upload onboarding documents:", err);
      return NextResponse.json(
        { error: "Could not upload your documents. Please try again in a moment." },
        { status: 500 }
      );
    }
  }

  try {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...data,
        ...uploaded,
        onboardingCompletedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Failed to save onboarding details:", err);
    return NextResponse.json(
      { error: "Could not save your details. Please try again in a moment." },
      { status: 500 }
    );
  }

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "ONBOARDING_SUBMITTED",
    actor: "CLIENT",
    actorName: data.name,
    description: "Submitted onboarding details",
  });

  const view = await getPublicEmployeeOnboardingView(params.token);
  if (!view) {
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  }
  return NextResponse.json(view, { status: 200 });
}
