import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOutsideLeaveColumns, leaveFileResponse } from "@/lib/outsideLeave";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { token: string; id: string } }) {
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({ where: { leaveManagerToken: params.token }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "This link is invalid." }, { status: 404 });
  const item = await prisma.leaveRequest.findFirst({
    where: { id: params.id, employeeId: employee.id },
    select: { documentData: true, documentName: true },
  });
  const file = leaveFileResponse(item?.documentData, item?.documentName);
  if (!file) return NextResponse.json({ error: "No file is saved on this request." }, { status: 404 });
  return file;
}
