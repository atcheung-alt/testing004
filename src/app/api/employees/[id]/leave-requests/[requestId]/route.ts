import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { logActivity } from "@/lib/activity";
import { notifyColleagueOfLeaveDecision } from "@/lib/outsideLeave";

// Staff can only decide a request one way or the other from here — moving
// it back to PENDING isn't a supported action (see VALID_LEAVE_STATUSES in
// src/lib/employees.ts for the full status set, which also includes the
// starting PENDING state that requests are created in).
const DECIDABLE_STATUSES = ["APPROVED", "REJECTED"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const body = await request.json().catch(() => ({}));
  if (!DECIDABLE_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "Status must be either APPROVED or REJECTED." },
      { status: 400 }
    );
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id: params.requestId },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          personalEmail: true,
          companyEmail: true,
          lineManagerName: true,
          company: { select: { name: true } },
        },
      },
    },
  });
  if (!existing || existing.employeeId !== params.id) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 });
  }
  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "This request has already been decided." },
      { status: 409 }
    );
  }

  const decidedNote = typeof body.decidedNote === "string" ? body.decidedNote.trim() || null : null;

  const leaveRequest = await prisma.leaveRequest.update({
    where: { id: params.requestId },
    data: { status: body.status, decidedAt: new Date(), decidedNote },
  });
  try {
    await notifyColleagueOfLeaveDecision(existing.employee, { ...leaveRequest, decidedNote }, body.status === "APPROVED");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "The decision was saved, but the email to the colleague could not be sent." },
      { status: 502 }
    );
  }

  await logActivity({
    documentType: "employee",
    documentId: existing.employee.id,
    type: "EDITED",
    description: `Leave request (${formatDate(existing.startDate)} – ${formatDate(existing.endDate)}) for ${existing.employee.name} ${body.status === "APPROVED" ? "approved" : "rejected"}`,
  });

  return NextResponse.json(leaveRequest);
}
