import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { canManageEmployee } from "@/lib/documentAccess";
import { isValidPeriod } from "@/lib/payroll";
import { buildSalaryReportPdf } from "@/lib/pdf/build";
import { pdfContentDisposition } from "@/lib/pdf/language";
import { pdfLanguageFromRequest } from "@/lib/i18n/downloadLanguage";

export const runtime = "nodejs";

/** GET ?from=YYYY-MM&to=YYYY-MM — a PDF salary report for this employee
 *  covering every payroll run in that (inclusive) range. See
 *  buildSalaryReportPdf for how periods outside the range are excluded and
 *  what happens when no entries exist in range. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    const denied = await requireAdminApi();
    return denied || NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  const language = pdfLanguageFromRequest(request);
  if (!isValidPeriod(from) || !isValidPeriod(to)) {
    return NextResponse.json({ error: "A valid 'from' and 'to' period (YYYY-MM) are required." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "'From' must be on or before 'to'." }, { status: 400 });
  }

  const built = await buildSalaryReportPdf(params.id, from, to, language);
  if (!built) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(
        `${built.employeeName} - Salary Report ${from} to ${to}.pdf`,
        language
      ),
    },
  });
}
