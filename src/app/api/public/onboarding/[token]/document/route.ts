import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onboardingDocumentError } from "@/lib/employees";
import { isDriveConfigured } from "@/lib/googleDrive";
import { uploadEmployeeOnboardingDocument } from "@/lib/driveSync";
import { parseDataUrl } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const DOCUMENTS = {
  addressProof: {
    label: "Proof of Address",
    errorLabel: "your proof of address",
    idField: "addressProofDriveFileId",
    urlField: "addressProofDriveUrl",
  },
  bankStatement: {
    label: "Bank Statement",
    errorLabel: "your bank statement",
    idField: "bankStatementDriveFileId",
    urlField: "bankStatementDriveUrl",
  },
  hkidDocument: {
    label: "HKID",
    errorLabel: "a copy of your HKID",
    idField: "hkidDocumentDriveFileId",
    urlField: "hkidDocumentDriveUrl",
  },
} as const;

type DocumentKind = keyof typeof DOCUMENTS;

function extensionForContentType(contentType: string): string {
  const map: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
  return map[contentType] || contentType.split("/")[1] || "bin";
}

/** Save one onboarding file. One file per request stays small enough to send. */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const employee = await prisma.employee.findUnique({
    where: { onboardingToken: params.token },
    select: { id: true, onboardingCompletedAt: true },
  });
  if (!employee) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (employee.onboardingCompletedAt) {
    return NextResponse.json({ error: "This onboarding form has already been submitted." }, { status: 409 });
  }
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Document storage isn't configured yet. Please contact HR before submitting." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const kind = body.kind as DocumentKind;
  const spec = DOCUMENTS[kind];
  if (!spec) return NextResponse.json({ error: "That document type isn't recognised." }, { status: 400 });
  const problem = onboardingDocumentError(body.data, spec.errorLabel);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    const parsed = parseDataUrl(body.data)!;
    const file = await uploadEmployeeOnboardingDocument(
      employee.id,
      spec.label,
      extensionForContentType(parsed.contentType),
      parsed.buffer
    );
    await prisma.employee.update({
      where: { id: employee.id },
      data: { [spec.idField]: file.id, [spec.urlField]: file.webViewLink },
    });
  } catch (err) {
    console.error("Failed to upload one onboarding document:", err);
    return NextResponse.json(
      { error: "Could not upload your documents. Please try again in a moment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
