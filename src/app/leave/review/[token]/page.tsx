import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureOutsideLeaveColumns } from "@/lib/outsideLeave";
import LeaveReviewClient from "@/components/LeaveReviewClient";

export const dynamic = "force-dynamic";

export default async function LeaveReviewPage({ params }: { params: { token: string } }) {
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { leaveManagerToken: params.token },
    include: { leaveRequests: { orderBy: { createdAt: "desc" } } },
  });
  if (!employee) notFound();

  return (
    <LeaveReviewClient
      token={params.token}
      employeeName={employee.name}
      initial={employee.leaveRequests.map((request) => ({
        id: request.id,
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        reason: request.reason,
        documentName: request.documentName,
        status: request.status,
        decidedNote: request.decidedNote,
      }))}
    />
  );
}
