import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { employeeVisibleById } from "@/lib/documentAccess";
import { leaveUrlFromHeaders } from "@/lib/signing";
import { ensureLeaveToken } from "@/lib/signing";
import { ensureLeaveManagerToken, isOutsideColleague, sendOutsideLeaveLinks } from "@/lib/outsideLeave";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await employeeVisibleById(params.id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { company: { select: { name: true } } },
  });
  if (!employee || !isOutsideColleague(employee.company?.name)) {
    return NextResponse.json({ error: "This leave email is only for colleagues outside HR Plus." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const colleagueEmail = String(body.colleagueEmail || "").trim();
  const lineManagerEmail = String(body.lineManagerEmail || "").trim();
  const leaveToken = await ensureLeaveToken(employee.id);
  const managerToken = await ensureLeaveManagerToken(employee.id);
  if (!leaveToken || !managerToken) {
    return NextResponse.json({ error: "This employee record was not found." }, { status: 404 });
  }
  const colleagueUrl = leaveUrlFromHeaders(leaveToken);
  const managerUrl = colleagueUrl.replace(/\/leave\/[^/]+$/, `/leave/review/${managerToken}`);

  try {
    await sendOutsideLeaveLinks({
      employeeId: employee.id,
      colleagueEmail,
      lineManagerEmail,
      colleagueUrl,
      managerUrl,
      employeeName: employee.name,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "The emails could not be sent." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
