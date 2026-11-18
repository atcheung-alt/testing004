import { notFound } from "next/navigation";
import { ensureRecordColumns, prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { computeLeaveBalance } from "@/lib/employees";
import { ensureOutsideLeaveColumns } from "@/lib/outsideLeave";
import LeaveReviewClient from "@/components/LeaveReviewClient";
import { getEffectiveCompany } from "@/lib/appSettings";

export const dynamic = "force-dynamic";

export default async function LeaveReviewPage({ params }: { params: { token: string } }) {
  await ensureRecordColumns();
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { leaveManagerToken: params.token },
    include: { leaveRequests: { orderBy: { createdAt: "desc" } }, company: { select: { name: true } } },
  });
  if (!employee) notFound();
  const companyProfile = await getEffectiveCompany();
  const balance = computeLeaveBalance(employee.annualLeaveDays, employee.startDate, employee.leaveRequests);

  return (
    <LeaveReviewClient
      token={params.token}
      employeeName={employee.name}
      company={employee.company?.name || ""}
      title={employee.title || ""}
      email={employee.email || employee.personalEmail || employee.companyEmail || ""}
      annualLeaveLeft={balance.remaining}
      startDate={employee.startDate ? formatDate(employee.startDate) : "—"}
      initial={employee.leaveRequests.map((request) => ({
        id: request.id,
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        reason: request.reason,
        documentName: request.documentName,
        hasDocument: Boolean(request.documentData),
        status: request.status,
        decidedNote: request.decidedNote,
      }))}
      logoData={companyProfile.logoData}
      logoDataDark={companyProfile.logoDataDark}
    />
  );
}
