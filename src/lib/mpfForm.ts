import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSigningToken, resolveBaseUrl } from "@/lib/signing";

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
    </table>
    <p style="font-size:12px;color:#9AA3B8;text-align:center;margin:0 0 4px;">Or copy this link into your browser:</p>
    <p style="font-size:12px;text-align:center;margin:0 0 8px;word-break:break-all;"><a href="${safeUrl}" style="color:#3D63E0;">${safeUrl}</a></p>`;
}

export function mpfEmailBody(name: string, doneUrl: string, uploadUrl: string): string {
  return [
    `Hello ${name},`,
    "",
    "There are two methods. Please choose one.",
    "",
    "1. On the eMPF app",
    `1. Download 積金易 (eMPF), or use the website.`,
    `iPhone — App Store: ${MPF_APP_STORE_URL}`,
    `Android — Google Play: ${MPF_PLAY_STORE_URL}`,
    `Website: ${MPF_WEBSITE_URL}`,
    "2. Open the job notice from the eMPF app, SMS, or email.",
    "3. Log in. Choose your fund. Sign.",
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

/** HTML version of the MPF email. The Payroll Group line is the ! notice. */
export function mpfEmailHtml(name: string, doneUrl: string, uploadUrl: string): string {
  const notice = "You do not need to fill in the Payroll Group.";
  return `
    <p style="margin:0 0 18px;font-size:21px;line-height:1.4;font-weight:600;color:#3D63E0;">Hello ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;">There are two methods. Please choose one.</p>
    <p style="margin:0 0 10px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#2F4FBD;font-weight:700;">1. On the eMPF app</p>
    <ol style="margin:0 0 8px;padding-left:20px;">
      <li style="margin:0 0 8px;">Download <strong>積金易 (eMPF)</strong>, or use the website.<br>
        <a href="${MPF_APP_STORE_URL}" style="color:#3D63E0;">iPhone — App Store</a><br>
        <a href="${MPF_PLAY_STORE_URL}" style="color:#3D63E0;">Android — Google Play</a><br>
        <a href="${MPF_WEBSITE_URL}" style="color:#3D63E0;">Website — empf.org.hk</a>
      </li>
      <li style="margin:0 0 8px;">Open the job notice from the eMPF app, SMS, or email.</li>
      <li style="margin:0 0 8px;">Log in. Choose your fund. Sign.
        <span class="mpf-tip" title="${escapeHtml(notice)}" style="position:relative;display:inline-block;margin-left:6px;vertical-align:middle;cursor:help;">
          <span style="display:inline-block;width:18px;height:18px;border-radius:999px;background:#fff4d6;color:#9a6700;font-weight:700;font-size:12px;line-height:18px;text-align:center;">!</span>
          <span class="mpf-note" style="display:none;">${escapeHtml(notice)}</span>
        </span>
      </li>
    </ol>
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
    ${emailButton(uploadUrl, "Upload Individual eMPF Form")}
    <style>
      .mpf-tip:hover .mpf-note {
        display:block !important;
        position:absolute;
        left:0;
        bottom:24px;
        width:240px;
        background:#1B2436;
        color:#ffffff;
        font-size:12.5px;
        font-weight:500;
        line-height:1.45;
        border-radius:8px;
        padding:8px 10px;
        z-index:2;
      }
    </style>`;
}
