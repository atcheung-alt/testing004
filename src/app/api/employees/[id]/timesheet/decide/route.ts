import { NextRequest, NextResponse } from "next/server";
import { canManageEmployee } from "@/lib/documentAccess";
import { isValidPeriod } from "@/lib/payroll";
import { decideTimesheet } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const period = typeof body.period === "string" ? body.period : "";
  const action = body.action === "reject" ? "reject" : body.action === "approve" ? "approve" : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!isValidPeriod(period) || !action) {
    return NextResponse.json({ error: "Choose a month and approve or send it back." }, { status: 400 });
  }
  const sheet = await decideTimesheet(params.id, period, action, note);
  if (!sheet) {
    return NextResponse.json({ error: "There are no submitted hours for that month." }, { status: 404 });
  }
  return NextResponse.json({ status: sheet.status });
}
