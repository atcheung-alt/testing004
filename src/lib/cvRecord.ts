import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DOCUMENT_TYPE = "cv-record";

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

function readRecord(description: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(description || "{}");
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listCvRecords(): Promise<Record<string, unknown>[]> {
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: DOCUMENT_TYPE },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => readRecord(row.description)).filter((row): row is Record<string, unknown> => !!row);
}

export async function saveCvRecord(record: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = String(record.id || "").trim();
  if (!id) throw new Error("Missing CV id.");
  const stored = { ...record, id };
  const description = JSON.stringify(stored);
  const existing = await prisma.activityEvent.findFirst({
    where: { documentType: DOCUMENT_TYPE, documentId: id },
  });
  if (existing) {
    await prisma.activityEvent.update({
      where: { id: existing.id },
      data: { description },
    });
    return stored;
  }
  await prisma.activityEvent.create({
    data: {
      documentType: DOCUMENT_TYPE,
      documentId: id,
      type: "SAVED",
      actor: "STAFF",
      actorName: await actorName(),
      description,
    },
  });
  return stored;
}

export async function deleteCvRecord(id: string): Promise<void> {
  await prisma.activityEvent.deleteMany({
    where: { documentType: DOCUMENT_TYPE, documentId: id },
  });
}
