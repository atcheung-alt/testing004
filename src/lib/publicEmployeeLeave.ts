import { prisma } from "@/lib/prisma";
import { computeLeaveBalance, requestDuration } from "@/lib/employees";
import { logClientView } from "@/lib/activity";
import { getEffectiveCompany } from "@/lib/appSettings";
import { ensureOutsideLeaveColumns, isOutsideColleague } from "@/lib/outsideLeave";

export type PublicLeaveRequestView = {
  id: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod: string | null;
  days: number;
  reason: string;
  leaveType: string;
  documentName: string | null;
  status: string;
  decidedNote: string | null;
  createdAt: string;
};

export type PublicEmployeeLeaveView = {
  id: string;
  name: string;
  status: string;
  // Despite the field name (kept as-is to avoid touching every consumer),
  // this is the *accrued-so-far* entitlement, not the flat annual figure —
  // see computeAccruedEntitlement in src/lib/employees.ts.
  annualLeaveDays: number;
  leaveUsed: number;
  leaveRemaining: number;
  // False once an employee has left — the link stays viewable (so they can
  // still see their past history) but the request form itself is hidden.
  // Onboarding employees can still request leave (they're current staff,
  // just mid-paperwork) — only FORMER blocks it.
  canRequestLeave: boolean;
  outsideCompany: boolean;
  leaveRequests: PublicLeaveRequestView[];
  company: { name: string; shortName?: string; logoData?: string | null; logoDataDark?: string | null };
};

/**
 * Token-scoped, read-only view of an employee's leave balance/history,
 * shared by the public API route and the /leave/[token] page's server-side
 * initial render. No authentication — the random leave token is the access
 * control, exactly like Quotation.signingToken.
 */
export async function getPublicEmployeeLeaveView(token: string): Promise<PublicEmployeeLeaveView | null> {
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { leaveToken: token },
    include: { leaveRequests: { orderBy: { createdAt: "desc" } }, company: { select: { name: true } } },
  });
  if (!employee) return null;

  await logClientView("employee", employee.id);

  const { entitlement, used, remaining } = computeLeaveBalance(
    employee.annualLeaveDays,
    employee.startDate,
    employee.leaveRequests
  );
  const company = await getEffectiveCompany();

  return {
    id: employee.id,
    name: employee.name,
    status: employee.status,
    annualLeaveDays: entitlement,
    leaveUsed: used,
    leaveRemaining: remaining,
    canRequestLeave: employee.status !== "FORMER",
    outsideCompany: isOutsideColleague(employee.company?.name),
    leaveRequests: employee.leaveRequests.map((r) => ({
      id: r.id,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      isHalfDay: r.isHalfDay,
      halfDayPeriod: r.halfDayPeriod,
      days: requestDuration(r),
      reason: r.reason,
      leaveType: r.leaveType,
      documentName: r.documentName,
      status: r.status,
      decidedNote: r.decidedNote,
      createdAt: r.createdAt.toISOString(),
    })),
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      logoDataDark: company.logoDataDark,
    },
  };
}
