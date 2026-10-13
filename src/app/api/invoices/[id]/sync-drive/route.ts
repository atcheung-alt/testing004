import { NextRequest, NextResponse } from "next/server";
import { isDriveConfigured } from "@/lib/googleDrive";
import { syncInvoiceRecordToDrive } from "@/lib/driveSync";
import { pdfLanguageFromBody } from "@/lib/pdf/language";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: "Google Drive isn't configured on the server (see .env.example)." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const warning = await syncInvoiceRecordToDrive(params.id, pdfLanguageFromBody(body.pdfLanguage));
  return NextResponse.json({ success: !warning, warning });
}
