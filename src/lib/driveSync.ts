import { prisma } from "@/lib/prisma";
import { buildQuotationPdf, buildInvoicePdf, buildReceiptPdf, buildEmployeeContractPdf, buildPayslipPdf } from "@/lib/pdf/build";
import { isDriveConfigured, findOrCreateFolder, upsertDriveFile } from "@/lib/googleDrive";
import { getEffectiveDriveFolderId } from "@/lib/appSettings";
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/employees";
import { contractDocumentTitleFor } from "@/lib/employeeContractTerms";
import { logActivity } from "@/lib/activity";
import { pdfFileName, pdfLanguageLabel } from "@/lib/pdf/language";

/** Keep folder names filesystem/Drive-safe and reasonably short. */
function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 120) || "Untitled project";
}

// One shared "Records" folder at the Drive root holds every year, and under
// each year one folder per document type — Records/{Year}/{Quotation,
// Invoice, Receipt} — instead of the previous "one folder per client/
// project" shape. Quotation, Invoice, and Receipt PDFs are now kept
// separate from each other rather than landing side by side.
const RECORDS_ROOT_FOLDER_NAME = "Records";
const QUOTATION_FOLDER_NAME = "Quotation";
const INVOICE_FOLDER_NAME = "Invoice";
const RECEIPT_FOLDER_NAME = "Receipt";

/** The year a document's Drive folder should live under — its own issue
 *  date, not the date it happens to sync, so back-dated or late-synced
 *  documents still land under the year they were actually issued. */
function yearFolderNameFor(issueDate: Date | string): string {
  const d = typeof issueDate === "string" ? new Date(issueDate) : issueDate;
  return String(d.getFullYear());
}

/**
 * Resolve (creating as needed) Records/{Year}/{typeFolderName} and return
 * its Drive folder ID. Always re-resolved by name rather than trusted from
 * a cached driveFolderId column: findOrCreateFolder is a cheap, idempotent
 * name lookup, and re-resolving means a record still carrying a folder ID
 * from the old shared "Records/{client}" scheme self-heals onto the new
 * Year/Type structure the next time it syncs, instead of quietly staying in
 * its old folder forever.
 */
async function ensureRecordsTypeFolder(typeFolderName: string, issueDate: Date | string): Promise<string> {
  const rootFolderId = await getEffectiveDriveFolderId();
  const recordsRootId = await findOrCreateFolder(RECORDS_ROOT_FOLDER_NAME, rootFolderId);
  const yearFolderId = await findOrCreateFolder(yearFolderNameFor(issueDate), recordsRootId);
  return findOrCreateFolder(typeFolderName, yearFolderId);
}

/**
 * After a receipt is generated, push the latest quotation, invoice, and
 * receipt PDFs into their own Records/{Year}/{Type} Google Drive folder —
 * see ensureRecordsTypeFolder above. Each file is updated in place on every
 * run rather than re-uploaded as a new file, so Drive never accumulates
 * outdated or duplicate copies.
 *
 * Each of the three uploads (including its own folder resolution) is
 * isolated in its own try/catch — one failing (e.g. a transient network
 * error on the quotation) must never prevent the other two from still being
 * attempted.
 *
 * Returns a warning message describing anything that failed, or null if
 * everything synced successfully / Drive isn't configured (a no-op — this
 * feature is entirely optional).
 */
export async function syncInvoiceRecordToDrive(
  invoiceId: string,
  language?: string | null
): Promise<string | null> {
  if (!isDriveConfigured()) return null;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { quotation: true, receipt: true },
  });
  if (!invoice) return "Could not sync to Google Drive: invoice not found.";

  const warnings: string[] = [];

  if (invoice.quotation) {
    try {
      const built = await buildQuotationPdf(invoice.quotation.id, language);
      if (built) {
        const folderId = await ensureRecordsTypeFolder(QUOTATION_FOLDER_NAME, invoice.quotation.issueDate);
        const file = await upsertDriveFile({
          fileId: invoice.quotation.driveFileId,
          name: pdfFileName(built.number, language || built.data.language),
          folderId,
          buffer: built.buffer,
        });
        await prisma.quotation.update({
          where: { id: invoice.quotation.id },
          data: { driveFolderId: folderId, driveFileId: file.id, driveFileUrl: file.webViewLink },
        });
        await logActivity({
          documentType: "quotation",
          documentId: invoice.quotation.id,
          type: "DRIVE_UPLOAD",
          actor: "SYSTEM",
          description: `Synced to Google Drive (${pdfLanguageLabel(language || built.data.language)})`,
        });
      }
    } catch (err: any) {
      const message = err?.message || "Could not upload the quotation PDF.";
      console.error(`[driveSync] quotation upload failed for invoice ${invoiceId}:`, message);
      warnings.push(`Quotation: ${message}`);
    }
  }

  try {
    const builtInvoice = await buildInvoicePdf(invoice.id, language);
    if (builtInvoice) {
      const folderId = await ensureRecordsTypeFolder(INVOICE_FOLDER_NAME, invoice.issueDate);
      const file = await upsertDriveFile({
        fileId: invoice.driveFileId,
        name: pdfFileName(builtInvoice.number, language || builtInvoice.data.language),
        folderId,
        buffer: builtInvoice.buffer,
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { driveFolderId: folderId, driveFileId: file.id, driveFileUrl: file.webViewLink },
      });
      await logActivity({
        documentType: "invoice",
        documentId: invoice.id,
        type: "DRIVE_UPLOAD",
        actor: "SYSTEM",
        description: `Synced to Google Drive (${pdfLanguageLabel(language || builtInvoice.data.language)})`,
      });
    }
  } catch (err: any) {
    const message = err?.message || "Could not upload the invoice PDF.";
    console.error(`[driveSync] invoice upload failed for invoice ${invoiceId}:`, message);
    warnings.push(`Invoice: ${message}`);
  }

  if (invoice.receipt) {
    try {
      const builtReceipt = await buildReceiptPdf(invoice.id, language);
      if (builtReceipt) {
        const folderId = await ensureRecordsTypeFolder(RECEIPT_FOLDER_NAME, invoice.receipt.issueDate);
        const file = await upsertDriveFile({
          fileId: invoice.receipt.driveFileId,
          name: pdfFileName(builtReceipt.number, language || builtReceipt.data.language),
          folderId,
          buffer: builtReceipt.buffer,
        });
        await prisma.receipt.update({
          where: { id: invoice.receipt.id },
          data: { driveFileId: file.id, driveFileUrl: file.webViewLink },
        });
      }
    } catch (err: any) {
      const message = err?.message || "Could not upload the receipt PDF.";
      console.error(`[driveSync] receipt upload failed for invoice ${invoiceId}:`, message);
      warnings.push(`Receipt: ${message}`);
    }
  }

  if (!warnings.length) return null;
  const hint = warnings.some((w) => /storageQuotaExceeded/i.test(w))
    ? " (Service accounts have no storage quota — the configured Drive folder ID must point to a Shared Drive, not a personal Drive folder.)"
    : "";
  return `Google Drive sync issue — ${warnings.join(" | ")}${hint}`;
}

// -----------------------------------------------------------------------------
// HR documents (employment contracts + payslips) — a separate top-level
// "Employees" folder, one subfolder per employee, distinct from the
// per-quotation/invoice project folders above. Same upsert-in-place
// philosophy: every file is keyed to a stored driveFileId, so re-syncing
// (e.g. re-verifying a corrected contract) updates that same file instead of
// leaving stale duplicates behind.
// -----------------------------------------------------------------------------

const EMPLOYEES_ROOT_FOLDER_NAME = "Employees";

/**
 * Find (or create) this employee's own Drive subfolder, nested under one
 * shared "Employees" folder at the Drive root. Named "{name} - {employment
 * type}" the first time it's created, then cached on Employee.driveFolderId
 * and simply reused on every later call — so if the employee's name or
 * employment type changes afterward, the existing folder is NOT renamed,
 * same "create once, reuse forever" behavior as the quotation/invoice
 * project folders above. Both the verified contract and every payslip for
 * this employee land in this one folder.
 *
 * Returns null only if the employee itself doesn't exist.
 */
export async function ensureEmployeeDriveFolder(employeeId: string): Promise<string | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, employmentType: true, driveFolderId: true },
  });
  if (!employee) return null;
  if (employee.driveFolderId) return employee.driveFolderId;

  const rootFolderId = await getEffectiveDriveFolderId();
  const employeesRootId = await findOrCreateFolder(EMPLOYEES_ROOT_FOLDER_NAME, rootFolderId);
  const typeLabel = EMPLOYMENT_TYPE_LABELS[employee.employmentType || ""] || employee.employmentType || "Unspecified";
  const folderName = sanitizeFolderName(`${employee.name || "Unnamed"} - ${typeLabel}`);
  const folderId = await findOrCreateFolder(folderName, employeesRootId);

  await prisma.employee.update({ where: { id: employee.id }, data: { driveFolderId: folderId } });

  return folderId;
}

/**
 * Upload (or update in place) this employee's contract PDF into their Drive
 * folder — called once the contract is VERIFIED (see the PATCH route in
 * /api/employees/[id]/contract). A no-op if Drive isn't configured, or if
 * there's genuinely no contract yet; any failure is reported back as a
 * warning but never blocks the verification itself, which has already
 * succeeded by the time this runs.
 */
export async function syncEmployeeContractToDrive(employeeId: string): Promise<string | null> {
  if (!isDriveConfigured()) return null;

  try {
    const contract = await prisma.employeeContract.findUnique({
      where: { employeeId },
      include: { employee: { select: { employmentType: true } } },
    });
    if (!contract) return null;

    const folderId = await ensureEmployeeDriveFolder(employeeId);
    if (!folderId) return "Could not sync to Google Drive: employee not found.";

    const built = await buildEmployeeContractPdf(employeeId);
    if (!built) return null;

    const file = await upsertDriveFile({
      fileId: contract.driveFileId,
      name: `${contractDocumentTitleFor(contract.employee.employmentType)}.pdf`,
      folderId,
      buffer: built.buffer,
    });

    await prisma.employeeContract.update({
      where: { id: contract.id },
      data: { driveFileId: file.id, driveFileUrl: file.webViewLink },
    });

    await logActivity({
      documentType: "employee",
      documentId: employeeId,
      type: "DRIVE_UPLOAD",
      actor: "SYSTEM",
      description: "Contract synced to Google Drive",
    });

    return null;
  } catch (err: any) {
    const message = err?.message || "Could not upload the contract PDF.";
    console.error(`[driveSync] contract upload failed for employee ${employeeId}:`, message);
    const hint = /storageQuotaExceeded/i.test(message)
      ? " (Service accounts have no storage quota — the configured Drive folder ID must point to a Shared Drive, not a personal Drive folder.)"
      : "";
    return `Google Drive sync issue — Contract: ${message}${hint}`;
  }
}

/**
 * Upload one onboarding document (proof of address, bank statement, HKID
 * copy) into the employee's own Drive folder — called from the public
 * onboarding submit route (see /api/public/onboarding/[token]/submit). Named
 * by document type only ("Proof of Address.pdf" etc.), so re-submitting
 * (blocked in practice by the one-shot onboarding lock, but defensive
 * anyway) would overwrite rather than duplicate. Unlike the other Drive sync
 * functions above, this one is NOT best-effort: these documents are a
 * mandatory part of onboarding, so a failure here should surface as a real
 * error to the employee rather than being silently swallowed — callers
 * should let this throw and handle it themselves.
 */
export async function uploadEmployeeOnboardingDocument(
  employeeId: string,
  label: string,
  extension: string,
  buffer: Buffer,
  existingFileId?: string | null
): Promise<{ id: string; webViewLink: string }> {
  const folderId = await ensureEmployeeDriveFolder(employeeId);
  if (!folderId) {
    throw new Error("Could not find or create this employee's Drive folder.");
  }
  return upsertDriveFile({
    fileId: existingFileId || undefined,
    name: `${label}.${extension}`,
    folderId,
    buffer,
  });
}

/**
 * Upload every entry's payslip PDF for a payroll run into each employee's
 * own Drive folder — triggered manually via the "Sync to Drive" button on
 * the run page (see POST /api/payroll/[id]/drive-sync). Used to auto-fire on
 * finalize, but runs stay editable indefinitely now, so staff trigger this
 * explicitly whenever they want the current numbers pushed to Drive — safe
 * to re-run any time since it just re-uploads over the same file each entry
 * already has on file. Each entry is isolated in its own try/catch — one
 * employee's upload failing (a missing Drive folder permission, a transient
 * network error, etc.) must never prevent the rest of the run's payslips
 * from still being synced.
 *
 * Returns a warning message describing anything that failed, or null if
 * everything synced successfully / Drive isn't configured.
 */
export async function syncPayrollRunToDrive(runId: string): Promise<string | null> {
  if (!isDriveConfigured()) return null;

  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: { entries: true },
  });
  if (!run) return "Could not sync to Google Drive: payroll run not found.";

  const warnings: string[] = [];

  for (const entry of run.entries) {
    try {
      const folderId = await ensureEmployeeDriveFolder(entry.employeeId);
      if (!folderId) {
        warnings.push(`${entry.employeeName}: employee record not found.`);
        continue;
      }

      const built = await buildPayslipPdf(runId, entry.id);
      if (!built) continue;

      const file = await upsertDriveFile({
        fileId: entry.driveFileId,
        name: `Payslip - ${built.periodLabel}.pdf`,
        folderId,
        buffer: built.buffer,
      });

      await prisma.payrollEntry.update({
        where: { id: entry.id },
        data: { driveFileId: file.id, driveFileUrl: file.webViewLink },
      });
    } catch (err: any) {
      const message = err?.message || "Could not upload the payslip PDF.";
      console.error(`[driveSync] payslip upload failed for entry ${entry.id} (run ${runId}):`, message);
      warnings.push(`${entry.employeeName}: ${message}`);
    }
  }

  if (!warnings.length) return null;
  const hint = warnings.some((w) => /storageQuotaExceeded/i.test(w))
    ? " (Service accounts have no storage quota — the configured Drive folder ID must point to a Shared Drive, not a personal Drive folder.)"
    : "";
  return `Google Drive sync issue — ${warnings.join(" | ")}${hint}`;
}
