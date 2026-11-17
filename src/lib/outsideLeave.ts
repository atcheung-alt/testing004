import { prisma } from "@/lib/prisma";
import { isInternalCompanyName } from "@/lib/employerCompany";
import { generateSigningToken, leaveUrlFromHeaders } from "@/lib/signing";
import { isValidEmail } from "@/lib/settings";
import { sendDocumentEmail } from "@/lib/mailer";
import { formatDate } from "@/lib/calculations";

export const OUTSIDE_LEAVE_TYPES = ["ANNUAL", "SICK", "NO_PAY"] as const;
export type OutsideLeaveType = (typeof OUTSIDE_LEAVE_TYPES)[number];

export const OUTSIDE_LEAVE_LABELS: Record<OutsideLeaveType, string> = {
  ANNUAL: "Annual leave",
  SICK: "Sick leave",
  NO_PAY: "No-pay leave",
};

let columnsReady: Promise<void> | null = null;

export function ensureOutsideLeaveColumns() {
  if (!columnsReady) {
    columnsReady = (async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lineManagerEmail" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "lineManagerName" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveManagerToken" TEXT`);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_leaveManagerToken_key" ON "Employee"("leaveManagerToken")`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "leaveType" TEXT NOT NULL DEFAULT 'ANNUAL'`
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "documentName" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "documentData" TEXT`);
    })().catch((error) => {
      columnsReady = null;
      throw error;
    });
  }
  return columnsReady;
}

export function isOutsideColleague(companyName: string | null | undefined) {
  const name = companyName?.trim();
  if (!name) return false;
  return !isInternalCompanyName(name);
}

export function leaveFileResponse(dataUrl: string | null | undefined, name: string | null | undefined) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  const filename = (name || "leave-document").replace(/["\r\n]/g, "");
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function parseLeaveType(value: unknown): OutsideLeaveType {
  return OUTSIDE_LEAVE_TYPES.includes(value as OutsideLeaveType) ? (value as OutsideLeaveType) : "ANNUAL";
}

export async function ensureLeaveManagerToken(employeeId: string) {
  await ensureOutsideLeaveColumns();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { leaveManagerToken: true },
  });
  if (!employee) return null;
  if (employee.leaveManagerToken) return employee.leaveManagerToken;
  const token = generateSigningToken();
  await prisma.employee.update({ where: { id: employeeId }, data: { leaveManagerToken: token } });
  return token;
}

export async function sendOutsideLeaveLinks({
  employeeId,
  colleagueEmail,
  lineManagerName,
  lineManagerEmail,
  colleagueUrl,
  managerUrl,
  employeeName,
}: {
  employeeId: string;
  colleagueEmail: string;
  lineManagerName: string;
  lineManagerEmail: string;
  colleagueUrl: string;
  managerUrl: string;
  employeeName: string;
}) {
  const managerName = lineManagerName.trim();
  if (!managerName) throw new Error("Enter the line manager's name.");
  if (!isValidEmail(colleagueEmail) || !isValidEmail(lineManagerEmail)) {
    throw new Error("Enter a valid email for the colleague and the line manager.");
  }
  await ensureOutsideLeaveColumns();
  const managerToken = await ensureLeaveManagerToken(employeeId);
  if (!managerToken) throw new Error("This employee record was not found.");
  await prisma.employee.update({
    where: { id: employeeId },
    data: { lineManagerEmail, lineManagerName: managerName },
  });

  const fromAddress = "HR Plus <contact@hrplus.info>";
  await sendDocumentEmail({
    to: colleagueEmail,
    fromAddress,
    hrSignature: true,
    subject: "Your leave link",
    body: `Hi ${employeeName},\n\nUse this link to request annual leave, sick leave, or no-pay leave. You do not need to sign in.\n\nYour line manager is ${managerName}. They will approve or reject each request.\n\n${colleagueUrl}`,
    signingUrl: colleagueUrl,
    ctaLabel: "Request leave",
  });
  await sendDocumentEmail({
    to: lineManagerEmail,
    fromAddress,
    hrSignature: true,
    subject: `Leave requests for ${employeeName}`,
    body: `Hi ${managerName},\n\nUse this link to approve or reject leave for ${employeeName}. A rejection needs a reason.\n\n${managerUrl}`,
    signingUrl: managerUrl,
    ctaLabel: "Review leave",
  });
}

export function managerLeaveUrl(managerToken: string) {
  return leaveUrlFromHeaders("leave-link").replace(/\/leave\/leave-link$/, `/leave/review/${managerToken}`);
}

/** Tell the line manager as soon as any leave type is submitted. */
export async function emailManagerAboutLeaveRequest({
  employeeId,
  lineManagerName,
  lineManagerEmail,
  employeeName,
  leaveLabel,
  when,
  reason,
}: {
  employeeId: string;
  lineManagerName: string;
  lineManagerEmail: string;
  employeeName: string;
  leaveLabel: string;
  when: string;
  reason: string;
}) {
  if (!isValidEmail(lineManagerEmail)) return;
  const managerToken = await ensureLeaveManagerToken(employeeId);
  if (!managerToken) return;
  const greeting = lineManagerName.trim() || "there";
  await sendDocumentEmail({
    to: lineManagerEmail,
    fromAddress: "HR Plus <contact@hrplus.info>",
    hrSignature: true,
    subject: `Leave request from ${employeeName}`,
    body: `Hi ${greeting},\n\n${employeeName} requested ${leaveLabel}.\nDates: ${when}\nReason: ${reason || "No reason given."}\n\nOpen your manager link to approve it, or reject it with a reason.`,
    signingUrl: managerLeaveUrl(managerToken),
    ctaLabel: "Review leave",
  });
}

/** Tell the colleague after the line manager or a staff member decides. */
export async function emailEmployeeAboutLeaveDecision({
  to,
  employeeName,
  managerName,
  leaveLabel,
  when,
  approved,
  reason,
}: {
  to: string;
  employeeName: string;
  managerName: string;
  leaveLabel: string;
  when: string;
  approved: boolean;
  reason: string;
}) {
  if (!isValidEmail(to)) return;
  const who = managerName.trim() || "Your line manager";
  await sendDocumentEmail({
    to,
    fromAddress: "HR Plus <contact@hrplus.info>",
    hrSignature: true,
    subject: approved ? "Your leave was approved" : "Your leave was not approved",
    body: approved
      ? `Hi ${employeeName},\n\n${who} approved your ${leaveLabel}.\nDates: ${when}`
      : `Hi ${employeeName},\n\n${who} did not approve your ${leaveLabel}.\nDates: ${when}\nReason: ${reason || "No reason given."}`,
  });
}

export async function notifyColleagueOfLeaveDecision(employee: {
  name: string;
  email: string | null;
  personalEmail: string | null;
  companyEmail: string | null;
  lineManagerName: string | null;
  company: { name: string } | null;
}, request: { leaveType: string; startDate: Date; endDate: Date; decidedNote: string | null }, approved: boolean) {
  if (!isOutsideColleague(employee.company?.name)) return;
  const to = [employee.email, employee.personalEmail, employee.companyEmail].map((value) => value?.trim() || "").find((value) => isValidEmail(value));
  if (!to) return;
  const label = OUTSIDE_LEAVE_LABELS[request.leaveType as OutsideLeaveType] || "leave";
  await emailEmployeeAboutLeaveDecision({
    to,
    employeeName: employee.name,
    managerName: employee.lineManagerName || "",
    leaveLabel: label,
    when: `${formatDate(request.startDate)} to ${formatDate(request.endDate)}`,
    approved,
    reason: request.decidedNote || "",
  });
}
