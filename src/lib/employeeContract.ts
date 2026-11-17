// -----------------------------------------------------------------------------
// Shared helpers for the EmployeeContract feature — request body
// normalization for the staff-facing contract details form, mirroring
// employeeFieldsFrom in src/lib/employees.ts.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";

export const VALID_EMPLOYEE_CONTRACT_STATUSES = ["DRAFT", "SENT", "SIGNED", "VERIFIED", "CANCELLED"];

export const CONTRACT_SIGN_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

let signColumnsReady: Promise<void> | null = null;

export function ensureContractSignColumns(): Promise<void> {
  if (!signColumnsReady) {
    signColumnsReady = (async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "sentForSignatureAt" TIMESTAMP(3)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "sentByEmail" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "EmployeeContract" ADD COLUMN IF NOT EXISTS "signatureReminderSentAt" TIMESTAMP(3)`);
    })().catch((error) => {
      signColumnsReady = null;
      throw error;
    });
  }
  return signColumnsReady;
}

export function contractSignLinkExpired(contract: {
  status: string;
  signedAt: Date | null;
  sentForSignatureAt: Date | null;
}, now = new Date()) {
  if (contract.status !== "SENT" || contract.signedAt || !contract.sentForSignatureAt) return false;
  return now.getTime() > contract.sentForSignatureAt.getTime() + CONTRACT_SIGN_WINDOW_MS;
}

export function trimmedOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type EmployeeContractFields = {
  terms: string;
  probationPeriod: string | null;
  contractEndDate: Date | null;
  workLocation: string | null;
  workSchedule: string | null;
};

/**
 * Extract a contract's editable fields from a staff-submitted request body.
 * `terms` may be empty on first creation (the form auto-generates it from
 * the template client-side, same pattern as RecruitmentAgreementForm) — this
 * layer doesn't require it, since a blank draft is still a valid save.
 */
export function employeeContractFieldsFrom(body: any): EmployeeContractFields {
  return {
    terms: typeof body.terms === "string" ? body.terms : "",
    probationPeriod: trimmedOrNull(body.probationPeriod),
    contractEndDate: parseOptionalDate(body.contractEndDate),
    workLocation: trimmedOrNull(body.workLocation),
    workSchedule: trimmedOrNull(body.workSchedule),
  };
}

/** One email to the staff account that sent the contract, once the 3 days pass with no signature. */
export async function remindUnsignedContract(contractId: string) {
  await ensureContractSignColumns();
  const contract = await prisma.employeeContract.findUnique({
    where: { id: contractId },
    include: { employee: { select: { name: true } } },
  });
  if (!contract || !contractSignLinkExpired(contract) || contract.signatureReminderSentAt) return false;
  if (!contract.sentByEmail || !isValidEmail(contract.sentByEmail)) return false;
  await sendDocumentEmail({
    to: contract.sentByEmail,
    subject: `${contract.employee.name} has not signed the contract`,
    body: `Hello,\n\n${contract.employee.name} did not sign within 3 days. The signing link has expired.\n\nOpen their employee page and send the contract email again. That gives them 3 new days.`,
    hrSignature: true,
  });
  await prisma.employeeContract.update({
    where: { id: contract.id },
    data: { signatureReminderSentAt: new Date() },
  });
  return true;
}

export async function remindAllUnsignedContracts() {
  await ensureContractSignColumns();
  const rows = await prisma.employeeContract.findMany({
    where: { status: "SENT", signedAt: null, signatureReminderSentAt: null, sentForSignatureAt: { not: null } },
    select: { id: true },
  });
  let sent = 0;
  for (const row of rows) {
    try {
      if (await remindUnsignedContract(row.id)) sent += 1;
    } catch (error) {
      console.error("[contract sign reminder]", row.id, error);
    }
  }
  return sent;
}
