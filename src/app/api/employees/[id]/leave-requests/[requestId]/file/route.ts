import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ensureOutsideLeaveColumns, leaveFileResponse } from "@/lib/outsideLeave";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string; requestId: string } }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await ensureOutsideLeaveColumns();
  const item = await prisma.leaveRequest.findFirst({
    where: { id: params.requestId, employeeId: params.id },
    select: { documentData: true, documentName: true },
  });
  const file = leaveFileResponse(item?.documentData, item?.documentName);
  if (!file) return NextResponse.json({ error: "No file is saved on this request." }, { status: 404 });
  return file;
}
