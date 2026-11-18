import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { onboardingDocumentError } from "@/lib/employees";
import { isDriveConfigured } from "@/lib/googleDrive";
import { ensureEmploymentContractFolder } from "@/lib/driveSync";
import { upsertDriveFile } from "@/lib/googleDrive";
import { parseDataUrl } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";
import { ensureRecordColumns } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Save a contract that was sent outside the system as "Contract file" in Drive. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  await ensureRecordColumns();

  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "File storage isn't configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const problem = onboardingDocumentError(body.data, "the contract");
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const parsed = parseDataUrl(body.data);
  if (!parsed) return NextResponse.json({ error: "Please attach the contract." }, { status: 400 });

  try {
    const folderId = await ensureEmploymentContractFolder(employee.id);
    if (!folderId) return NextResponse.json({ error: "Could not find this employee's Employment Contract folder." }, { status: 404 });
    const file = await upsertDriveFile({
      fileId: employee.contractFileDriveFileId || undefined,
      name: `Contract file.${EXTENSIONS[parsed.contentType] || "pdf"}`,
      folderId,
      buffer: parsed.buffer,
    });
    await prisma.employee.update({
      where: { id: employee.id },
      data: { contractFileDriveFileId: file.id, contractFileDriveUrl: file.webViewLink },
    });
    await logActivity({
      documentType: "employee",
      documentId: employee.id,
      type: "DRIVE_UPLOAD",
      description: `Contract file saved to Google Drive for ${employee.name}`,
    });
    return NextResponse.json({ success: true, url: file.webViewLink });
  } catch (err) {
    console.error("[contract file] drive upload failed", err);
    return NextResponse.json({ error: "Could not save the file. Please try again." }, { status: 500 });
  }
}
