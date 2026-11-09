import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onboardingDocumentError } from "@/lib/employees";
import { isDriveConfigured } from "@/lib/googleDrive";
import { uploadEmployeeOnboardingDocument } from "@/lib/driveSync";
import { parseDataUrl } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";
import { ensureMpfFormColumns, MPF_DRIVE_FILE_LABEL } from "@/lib/mpfForm";

export const dynamic = "force-dynamic";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Save the signed form in this employee's Drive folder as "MFP file". */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({ where: { mpfFormToken: params.token } });
  if (!employee) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "File storage isn't configured yet. Please contact HR Plus." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const problem = onboardingDocumentError(body.data, "your signed Individual eMPF Form");
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const parsed = parseDataUrl(body.data);
  if (!parsed) return NextResponse.json({ error: "Please attach your signed Individual eMPF Form." }, { status: 400 });

  try {
    const file = await uploadEmployeeOnboardingDocument(
      employee.id,
      MPF_DRIVE_FILE_LABEL,
      EXTENSIONS[parsed.contentType] || "pdf",
      parsed.buffer,
      employee.mpfFormDriveFileId
    );
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        mpfFormDriveFileId: file.id,
        mpfFormDriveUrl: file.webViewLink,
        mpfVerifiedAt: employee.mpfVerifiedAt ?? new Date(),
      },
    });
    await logActivity({
      documentType: "employee",
      documentId: employee.id,
      type: "DRIVE_UPLOAD",
      description: `MFP file saved to Google Drive for ${employee.name}`,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mpf] drive upload failed", err);
    return NextResponse.json({ error: "Could not save the file. Please try again." }, { status: 500 });
  }
}
