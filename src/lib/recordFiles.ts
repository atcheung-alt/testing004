import { prisma } from "@/lib/prisma";
import { deleteDriveFile, findOrCreateFolder, isDriveConfigured, upsertDriveFile } from "@/lib/googleDrive";
import { getEffectiveDriveFolderId } from "@/lib/appSettings";
import { isValidEmail } from "@/lib/settings";

const FOLDER_NAME = "Signed records";
const MAX_BYTES = 15 * 1024 * 1024;

export function creatorCopy(email: string | null | undefined, already: string[]) {
  const value = email?.trim().toLowerCase() || "";
  if (!isValidEmail(value)) return undefined;
  if (already.some((item) => item.trim().toLowerCase() === value)) return undefined;
  return [value];
}

export async function saveSignedRecord(args: {
  kind: "invoice" | "recruitment";
  id: string;
  number: string;
  existingFileId: string | null;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}) {
  if (!isDriveConfigured()) {
    throw new Error("Google Drive is not configured, so the file cannot be saved.");
  }
  if (args.bytes.length > MAX_BYTES) {
    throw new Error("That file is too large. Keep it under 15 MB.");
  }
  const root = await getEffectiveDriveFolderId();
  if (!root) throw new Error("No Drive folder is set for this site.");
  const folderId = await findOrCreateFolder(FOLDER_NAME, root);
  const safeName = args.fileName.replace(/[\\/]/g, " ").trim() || "record";
  const saved = await upsertDriveFile({
    name: `${args.number} - ${safeName}`,
    folderId,
    buffer: args.bytes,
    mimeType: args.mimeType || "application/octet-stream",
  });
  const data = { recordFileId: saved.id, recordFileUrl: saved.webViewLink, recordFileName: safeName };
  if (args.kind === "invoice") {
    await prisma.invoice.update({ where: { id: args.id }, data });
  } else {
    const current = await prisma.recruitmentAgreement.findUnique({
      where: { id: args.id },
      select: { status: true },
    });
    await prisma.recruitmentAgreement.update({
      where: { id: args.id },
      data: current?.status === "SENT" ? { ...data, status: "SIGNED", signedAt: new Date() } : data,
    });
  }
  if (args.existingFileId && args.existingFileId !== saved.id) {
    await deleteDriveFile(args.existingFileId).catch(() => undefined);
  }
  return data;
}

/** Remove the saved client file from the document, then from Drive. */
export async function deleteSignedRecord(args: {
  kind: "invoice" | "recruitment";
  id: string;
  fileId: string | null;
}) {
  if (args.fileId) await deleteDriveFile(args.fileId);
  const data = { recordFileId: null, recordFileUrl: null, recordFileName: null };
  if (args.kind === "invoice") {
    await prisma.invoice.update({ where: { id: args.id }, data });
  } else {
    await prisma.recruitmentAgreement.update({ where: { id: args.id }, data });
  }
}
