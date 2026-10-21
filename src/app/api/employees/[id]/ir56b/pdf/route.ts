import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { canManageEmployee } from "@/lib/documentAccess";
import { buildIR56BPdf } from "@/lib/pdf/build";

export const runtime = "nodejs";

/** GET ?year=YYYY — an IR56B draft/reference PDF for this employee, for the
 *  HK tax year ending 31 March of that year (e.g. year=2026 covers 1 Apr
 *  2025 – 31 Mar 2026). See buildIR56BPdf for what is/isn't auto-filled. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    const denied = await requireAdminApi();
    return denied || NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const yearParam = request.nextUrl.searchParams.get("year") || "";
  const year = Number(yearParam);
  if (!yearParam || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "A valid tax year (e.g. 2026) is required." }, { status: 400 });
  }

  const built = await buildIR56BPdf(params.id, year);
  if (!built) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${built.employeeName} - IR56B ${year}.pdf"`,
    },
  });
}
