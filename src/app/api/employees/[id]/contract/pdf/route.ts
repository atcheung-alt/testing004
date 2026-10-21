import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { canManageEmployee } from "@/lib/documentAccess";
import { buildEmployeeContractPdf } from "@/lib/pdf/build";
import { pdfContentDisposition } from "@/lib/pdf/language";
import { pdfLanguageFromRequest } from "@/lib/i18n/downloadLanguage";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    const denied = await requireAdminApi();
    return denied || NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const language = pdfLanguageFromRequest(request);
  const built = await buildEmployeeContractPdf(params.id, language);
  if (!built) {
    return NextResponse.json({ error: "This employee has no contract yet." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(built.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(
        `${built.employeeName.replace(/\s+/g, "-")}-contract.pdf`,
        language
      ),
    },
  });
}
