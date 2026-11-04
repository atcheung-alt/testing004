import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DOCUMENT_TYPE = "cv-email";

export type CvEmailDraft = {
  id: string;
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
      to: String(parsed.to || ""),
      company: String(parsed.company || ""),
      position: String(parsed.position || ""),
      subject: String(parsed.subject || ""),
      bodyHtml: String(parsed.bodyHtml || ""),
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
    };
  } catch {
    return { to: "", company: "", position: "", subject: "", bodyHtml: "", candidates: [] };
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

export async function listCvEmails(): Promise<CvEmailDraft[]> {
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: DOCUMENT_TYPE },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toDraft);
}

export async function getCvEmail(id: string): Promise<CvEmailDraft | null> {
  const row = await prisma.activityEvent.findFirst({
    where: { id, documentType: DOCUMENT_TYPE },
  });
  return row ? toDraft(row) : null;
}

export async function saveCvEmail(input: Stored & { id?: string }): Promise<CvEmailDraft> {
  const description = JSON.stringify({
    to: input.to || "",
    company: input.company || "",
    position: input.position || "",
    subject: input.subject || "",
    bodyHtml: input.bodyHtml || "",
    candidates: input.candidates || [],
  });
  if (input.id) {
    const existing = await prisma.activityEvent.findFirst({
      where: { id: input.id, documentType: DOCUMENT_TYPE },
    });
    if (existing) {
      const row = await prisma.activityEvent.update({
        where: { id: existing.id },
        data: { description, type: existing.type === "SENT" ? "SENT" : "DRAFT" },
      });
      return toDraft(row);
    }
  }
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
