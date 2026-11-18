import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSigningToken, resolveBaseUrl } from "@/lib/signing";
import { sendDocumentEmail } from "@/lib/mailer";
import { isValidEmail } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export const MPF_VIDEO_URL = "https://youtu.be/oLe1339j_KA?si=DwA2AEQvFidn0sgx";
export const MPF_APP_STORE_URL = "https://apps.apple.com/hk/app/%E7%A9%8D%E9%87%91%E6%98%93-empf/id6480176219";
export const MPF_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=hk.org.empf";
export const MPF_WEBSITE_URL = "https://www.empf.org.hk/";
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
    await prisma.$executeRawUnsafe(`ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "mpfEmailDueAt" TIMESTAMP(3)`);
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailButton(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 8px;border-collapse:collapse;width:100%;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td align="center" style="border-radius:999px;background-color:#4F7CFF;background-image:linear-gradient(135deg,#4F7CFF 0%,#7F9BFA 45%,#9B6BEA 100%);">
                <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function mpfEmailBody(name: string, doneUrl: string, uploadUrl: string): string {
  return [
    `Hello ${name},`,
    "",
    "Please register on the eMPF app, or complete the paper form.",
    "",
    "1. On the eMPF app",
    `1. Download 積金易 (eMPF), or use the website.`,
    `iPhone — App Store: ${MPF_APP_STORE_URL}`,
    `Android — Google Play: ${MPF_PLAY_STORE_URL}`,
    `Website: ${MPF_WEBSITE_URL}`,
    "2. Open the job notice from the eMPF app, SMS, or email.",
    "3. Log in to your eMPF account, choose your fund, and sign.",
    "Note: You do not need to fill in the Payroll Group.",
    "",
    `I have finished eMPF registration: ${doneUrl}`,
    "",
    "2. Paper form",
    "Please use the enclosed Individual eMPF Form.",
    "1. Complete all required items on the form.",
    "2. Sign the form.",
    "3. Upload the signed form with the button below.",
    `Please watch this video on how to register, manage, and check your MPF account: ${MPF_VIDEO_URL}`,
    "",
    `Upload Individual eMPF Form: ${uploadUrl}`,
  ].join("\n");
}

/** HTML version of the MPF email. The Payroll Group line is a visible note. */
export function mpfEmailHtml(name: string, doneUrl: string, uploadUrl: string): string {
  return `
    <p style="margin:0 0 18px;font-size:21px;line-height:1.4;font-weight:600;color:#3D63E0;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;">Please register on the eMPF app, or complete the paper form.</p>
    <p style="margin:0 0 10px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#2F4FBD;font-weight:700;">1. On the eMPF app</p>
    <ol style="margin:0 0 8px;padding-left:20px;">
      <li style="margin:0 0 8px;">Download <strong>積金易 (eMPF)</strong>, or use the website.<br>
        <a href="${MPF_APP_STORE_URL}" style="color:#3D63E0;">iPhone — App Store</a><br>
        <a href="${MPF_PLAY_STORE_URL}" style="color:#3D63E0;">Android — Google Play</a><br>
        <a href="${MPF_WEBSITE_URL}" style="color:#3D63E0;">Website — empf.org.hk</a>
      </li>
      <li style="margin:0 0 8px;">Open the job notice from the eMPF app, SMS, or email.</li>
      <li style="margin:0 0 8px;">Log in to your eMPF account, choose your fund, and sign.</li>
    </ol>
    <p style="margin:12px 0 0;background:#fff8eb;border:1px solid #f3dfb0;border-radius:10px;padding:8px 12px;color:#9a6700;font-size:13px;">You do not need to fill in the Payroll Group.</p>
    ${emailButton(doneUrl, "I have finished eMPF registration")}
    <hr style="border:0;border-top:1px solid #E3E8F3;margin:22px 0;">
    <p style="margin:0 0 10px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#2F4FBD;font-weight:700;">2. Paper form</p>
    <p style="margin:0 0 10px;">Please use the enclosed Individual eMPF Form.</p>
    <ol style="margin:0 0 8px;padding-left:20px;">
      <li style="margin:0 0 8px;">Complete all required items on the form.</li>
      <li style="margin:0 0 8px;">Sign the form.</li>
      <li style="margin:0 0 8px;">Upload the signed form with the button below.</li>
    </ol>
    <p style="margin:4px 0 0;color:#66708A;font-size:13px;">Please watch this video on how to register, manage, and check your MPF account: <a href="${MPF_VIDEO_URL}" style="color:#3D63E0;">register, manage, and check your MPF</a></p>
    ${emailButton(uploadUrl, "Upload Individual eMPF Form")}`;
}

/** Emails the Individual eMPF Form once. A later call does nothing if it was already sent. */
export async function sendMpfFormToEmployee(employeeId: string, request?: NextRequest | Request) {
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { ok: false as const, error: "Employee not found." };
  if (employee.mpfFormSentAt || employee.mpfFormCompletedAt) return { ok: true as const, skipped: true };
  const to = (employee.personalEmail || employee.email || "").trim();
  if (!isValidEmail(to)) return { ok: false as const, error: "This employee has no email address." };
  const token = await ensureMpfFormToken(employee.id);
  if (!token) return { ok: false as const, error: "Employee not found." };
  const form = readIndividualEmpfForm();
  const doneUrl = mpfDoneUrlFor(token, request);
  const uploadUrl = mpfFormUrlFor(token, request);
  await sendDocumentEmail({
    to,
    subject: "Individual eMPF Form",
    body: mpfEmailBody(employee.name, doneUrl, uploadUrl),
    htmlBody: mpfEmailHtml(employee.name, doneUrl, uploadUrl),
    attachment: { filename: MPF_FORM_FILENAME, content: form },
    hrSignature: true,
  });
  await prisma.employee.update({
    where: { id: employee.id },
    data: { mpfFormSentAt: new Date() },
  });
  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "EMAIL_SENT",
    description: `Individual eMPF Form emailed to ${to}`,
  });
  return { ok: true as const, to };
}

/** After onboarding is signed, the MPF email waits one month. */
export async function scheduleMpfEmail(employeeId: string) {
  await ensureMpfFormColumns();
  const due = new Date();
  due.setMonth(due.getMonth() + 1);
  await prisma.$executeRaw`
    UPDATE "Employee"
    SET "mpfEmailDueAt" = ${due}
    WHERE "id" = ${employeeId}
      AND "mpfFormSentAt" IS NULL
      AND "mpfFormCompletedAt" IS NULL
      AND "mpfEmailDueAt" IS NULL
  `;
}

/** Sends MPF emails whose one-month wait has passed. */
export async function sendDueMpfEmails() {
  await ensureMpfFormColumns();
  const due = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Employee"
    WHERE "mpfEmailDueAt" IS NOT NULL
      AND "mpfEmailDueAt" <= NOW()
      AND "mpfFormSentAt" IS NULL
      AND "mpfFormCompletedAt" IS NULL
  `;
  let sent = 0;
  for (const row of due) {
    try {
      const result = await sendMpfFormToEmployee(row.id);
      if (result.ok && !("skipped" in result && result.skipped)) sent += 1;
    } catch (err) {
      console.error("[mpf email] scheduled send failed", row.id, err);
    }
  }
  return sent;
}
