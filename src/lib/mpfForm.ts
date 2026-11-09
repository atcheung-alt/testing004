import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSigningToken, resolveBaseUrl } from "@/lib/signing";

export const MPF_VIDEO_URL = "https://youtu.be/oLe1339j_KA?si=DwA2AEQvFidn0sgx";
export const MPF_FORM_FILENAME = "Individual eMPF Form.pdf";
/** The signed file's name in the employee's Google Drive folder. */
export const MPF_DRIVE_FILE_LABEL = "MFP file";

const FORM_CANDIDATES = [
  path.join(process.cwd(), "src", "lib", "mpf", "individual-empf-form.pdf"),
  path.join(__dirname, "mpf", "individual-empf-form.pdf"),
];

export function readIndividualEmpfForm(): Buffer {
  for (const candidate of FORM_CANDIDATES) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate);
  }
  throw new Error("The Individual eMPF Form file is missing.");
}

export function mpfFormUrlFor(token: string, request?: NextRequest | Request): string {
  return `${resolveBaseUrl(request)}/mpf/${token}`;
}

export function mpfDoneUrlFor(token: string, request?: NextRequest | Request): string {
  return `${resolveBaseUrl(request)}/mpf/${token}/done`;
}

let columnsReady: Promise<void> | null = null;

/** Add the MPF link columns if this database does not have them yet. */
export function ensureMpfFormColumns(): Promise<void> {
  columnsReady ??= (async () => {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfFormToken" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfFormSentAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfFormDriveFileId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfFormDriveUrl" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfFormCompletedAt" TIMESTAMP(3)`);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Employee_mpfFormToken_key" ON "Employee"("mpfFormToken")`
    );
  })().catch((error) => {
    columnsReady = null;
    throw error;
  });
  return columnsReady;
}

export async function ensureMpfFormToken(employeeId: string): Promise<string | null> {
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { mpfFormToken: true },
  });
  if (!employee) return null;
  if (employee.mpfFormToken) return employee.mpfFormToken;
  const token = generateSigningToken();
  await prisma.employee.update({
    where: { id: employeeId },
    data: { mpfFormToken: token },
  });
  return token;
}

export function mpfEmailBody(name: string): string {
  return [
    `Hello ${name},`,
    "",
    "Recommended: register online on eMPF. No paper form.",
    "",
    "1. HR Plus enters your name, phone number, and HKID in eMPF first.",
    "2. eMPF notifies you in the eMPF app, by SMS, or by email.",
    "3. Log in to your eMPF account, open that job notice, choose your fund, and sign online.",
    "",
    "When that is finished, press “I have finished eMPF registration”.",
    "",
    "If you cannot use eMPF online, use the attached Individual eMPF Form instead.",
    `Watch this video to register, manage, and check your MPF: ${MPF_VIDEO_URL}`,
    "Fill in and sign the form, then press “Upload Individual eMPF Form”.",
  ].join("\n");
}
