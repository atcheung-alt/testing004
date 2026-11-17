import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOutsideLeaveColumns, notifyColleagueOfLeaveDecision } from "@/lib/outsideLeave";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { leaveManagerToken: params.token },
    include: { company: { select: { name: true } } },
  });
  if (!employee) return NextResponse.json({ error: "This link is invalid." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action === "approve" ? "APPROVED" : body.action === "reject" ? "REJECTED" : null;
  const reason = String(body.reason || "").trim();
  if (!action || typeof body.id !== "string") {
    return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  }
  if (action === "REJECTED" && !reason) {
    return NextResponse.json({ error: "Write a reason before rejecting." }, { status: 400 });
  }

  const existing = await prisma.leaveRequest.findFirst({
    where: { id: body.id, employeeId: employee.id, status: "PENDING" },
  });
  if (!existing) return NextResponse.json({ error: "That request is no longer waiting." }, { status: 404 });

  const decided = await prisma.leaveRequest.update({
    where: { id: existing.id },
    data: { status: action, decidedAt: new Date(), decidedNote: action === "REJECTED" ? reason : null },
  });
  try {
    await notifyColleagueOfLeaveDecision(employee, decided, action === "APPROVED");
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "The decision was saved, but the email to the colleague could not be sent." },
      { status: 502 }
    );
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    requests: requests.map((item) => ({
      id: item.id,
      leaveType: item.leaveType,
      startDate: item.startDate.toISOString(),
      endDate: item.endDate.toISOString(),
      reason: item.reason,
      documentName: item.documentName,
      hasDocument: Boolean(item.documentData),
      status: item.status,
      decidedNote: item.decidedNote,
    })),
  });
}
