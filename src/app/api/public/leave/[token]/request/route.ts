import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { leaveRequestFieldsFrom } from "@/lib/employees";
import { getClientIp } from "@/lib/signing";
import { getPublicEmployeeLeaveView } from "@/lib/publicEmployeeLeave";
import { logActivity } from "@/lib/activity";
import { formatDate } from "@/lib/calculations";
import { emailManagerAboutLeaveRequest, ensureOutsideLeaveColumns, isOutsideColleague, OUTSIDE_LEAVE_LABELS, parseLeaveType } from "@/lib/outsideLeave";

export const runtime = "nodejs";

/**
 * Submit a new leave request through the public /leave/[token] link. The
 * request always starts PENDING — see the leave-requests/[requestId] route
 * under /api/employees for the staff approve/reject action.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const body = await request.json().catch(() => ({}));

  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { leaveToken: params.token },
    include: { company: { select: { name: true } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  // Onboarding employees can still request leave — they're current staff,
  // just mid-paperwork; only a FORMER (departed) employee is blocked. Keep
  // this in sync with canRequestLeave in src/lib/publicEmployeeLeave.ts.
  if (employee.status === "FORMER") {
    return NextResponse.json(
      { error: "This link can no longer be used to submit new leave requests." },
      { status: 403 }
    );
  }

  const fields = leaveRequestFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }
  const leaveType = parseLeaveType(body.leaveType);
  const documentName = String(body.documentName || "").trim().slice(0, 180);

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      startDate: fields.startDate!,
      endDate: fields.endDate!,
      isHalfDay: fields.isHalfDay,
      halfDayPeriod: fields.halfDayPeriod,
      reason: fields.reason,
      leaveType,
      documentName: documentName || null,
      submittedIp: getClientIp(request),
    },
  });

  if (isOutsideColleague(employee.company?.name) && employee.lineManagerEmail) {
    try {
      await emailManagerAboutLeaveRequest({
        employeeId: employee.id,
        lineManagerEmail: employee.lineManagerEmail,
        employeeName: employee.name,
        leaveLabel: OUTSIDE_LEAVE_LABELS[leaveType],
        when: `${formatDate(leaveRequest.startDate)} to ${formatDate(leaveRequest.endDate)}`,
        reason: fields.reason,
      });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || "The request was saved, but the email to the line manager could not be sent." },
        { status: 502 }
      );
    }
  }

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "CREATED",
    actor: "CLIENT",
    actorName: employee.name,
    description: `Requested ${OUTSIDE_LEAVE_LABELS[leaveType]} ${formatDate(leaveRequest.startDate)} – ${formatDate(leaveRequest.endDate)}`,
  });

  const view = await getPublicEmployeeLeaveView(params.token);
  return NextResponse.json(view, { status: 201 });
}
