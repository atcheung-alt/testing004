import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DOCUMENT_TYPE = "cv-email";

export type CvEmailDraft = {
  id: string;
  fileId: string;
  status: "DRAFT" | "SENT";
  to: string;
  company: string;
  position: string;
  subject: string;
  bodyHtml: string;
  candidates: unknown[];
  updatedAt: string;
};

type Stored = Omit<CvEmailDraft, "id" | "status" | "updatedAt">;

function readStored(description: string): Stored {
  try {
    const parsed = JSON.parse(description || "{}");
    return {
      fileId: String(parsed.fileId || ""),
      to: String(parsed.to || ""),
      company: String(parsed.company || ""),
      position: String(parsed.position || ""),
      subject: String(parsed.subject || ""),
      bodyHtml: String(parsed.bodyHtml || ""),
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    };
  } catch {
    return { fileId: "", to: "", company: "", position: "", subject: "", bodyHtml: "", candidates: [] };
  }
}

function toDraft(row: { id: string; type: string; description: string; createdAt: Date }): CvEmailDraft {
  return {
    id: row.id,
    status: row.type === "SENT" ? "SENT" : "DRAFT",
    ...readStored(row.description),
    updatedAt: row.createdAt.toISOString(),
  };
}

async function actorName(): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const email = user.email?.trim();
    const name = user.name?.trim();
    if (name && email && name.toLowerCase() !== email.toLowerCase()) return `${name} <${email}>`;
    return email || name || null;
  } catch {
    return null;
  }
}

function newFileId(taken: Set<string>): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  do {
    let tail = "";
    for (let i = 0; i < 4; i += 1) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
    id = `ECV-${day}-${tail}`;
  } while (taken.has(id));
  taken.add(id);
  return id;
}

export async function listCvEmails(): Promise<CvEmailDraft[]> {
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: DOCUMENT_TYPE },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const taken = new Set<string>();
  rows.forEach((row) => {
    const stored = readStored(row.description);
    if (stored.fileId) taken.add(stored.fileId);
  });
  const drafts: CvEmailDraft[] = [];
  for (const row of rows) {
    const stored = readStored(row.description);
    if (stored.fileId) {
      drafts.push(toDraft(row));
      continue;
    }
    stored.fileId = newFileId(taken);
    const updated = await prisma.activityEvent.update({
      where: { id: row.id },
      data: { description: JSON.stringify(stored) },
    });
    drafts.push(toDraft(updated));
  }
  return drafts;
}

export async function getCvEmail(id: string): Promise<CvEmailDraft | null> {
  const row = await prisma.activityEvent.findFirst({
    where: { id, documentType: DOCUMENT_TYPE },
  });
  return row ? toDraft(row) : null;
}

export async function saveCvEmail(input: Stored & { id?: string }): Promise<CvEmailDraft> {
  let fileId = String(input.fileId || "");
  if (input.id) {
    const existing = await prisma.activityEvent.findFirst({
      where: { id: input.id, documentType: DOCUMENT_TYPE },
    });
    if (existing) {
      const previous = readStored(existing.description);
      if (!fileId) fileId = previous.fileId;
      if (!fileId) fileId = newFileId(new Set(previous.fileId ? [previous.fileId] : []));
      const description = JSON.stringify({
        fileId,
        to: input.to || "",
        company: input.company || "",
        position: input.position || "",
        subject: input.subject || "",
        bodyHtml: input.bodyHtml || "",
        candidates: input.candidates || [],
      });
      const row = await prisma.activityEvent.update({
        where: { id: existing.id },
        data: { description, type: existing.type === "SENT" ? "SENT" : "DRAFT" },
      });
      return toDraft(row);
    }
  }
  if (!fileId) fileId = newFileId(new Set());
  const description = JSON.stringify({
    fileId,
    to: input.to || "",
    company: input.company || "",
    position: input.position || "",
    subject: input.subject || "",
    bodyHtml: input.bodyHtml || "",
    candidates: input.candidates || [],
  });
  const row = await prisma.activityEvent.create({
    data: {
      documentType: DOCUMENT_TYPE,
      documentId: "cv-email",
      type: "DRAFT",
      actor: "STAFF",
      actorName: await actorName(),
      description,
    },
  });
  const saved = await prisma.activityEvent.update({
    where: { id: row.id },
    data: { documentId: row.id },
  });
  return toDraft(saved);
}

export async function deleteCvEmail(id: string): Promise<void> {
  await prisma.activityEvent.deleteMany({
    where: { id, documentType: DOCUMENT_TYPE, type: "DRAFT" },
  });
}

export async function markCvEmailSent(id: string): Promise<void> {
  const existing = await prisma.activityEvent.findFirst({
    where: { id, documentType: DOCUMENT_TYPE },
  });
  if (!existing) return;
  await prisma.activityEvent.update({ where: { id: existing.id }, data: { type: "SENT" } });
}
