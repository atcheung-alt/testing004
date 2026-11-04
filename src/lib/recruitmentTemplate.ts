import { prisma } from "@/lib/prisma";

const DOCUMENT_TYPE = "recruitment-template";

export type RecruitmentTemplate = {
  id: string;
  name: string;
  role: string;
  requirements: string;
  paymentDueDays: number;
  language: string;
  terms: string;
  feeScalePermanent: { packageLabel: string; fee: string; guaranteePeriod: string }[];
  feeScaleContract: { packageLabel: string; fee: string; guaranteePeriod: string }[];
};

function read(description: string): RecruitmentTemplate | null {
  try {
    const parsed = JSON.parse(description || "{}");
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.name) return null;
    return parsed as RecruitmentTemplate;
  } catch {
    return null;
  }
}

export async function listRecruitmentTemplates(): Promise<RecruitmentTemplate[]> {
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: DOCUMENT_TYPE, type: "SAVED" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => read(row.description)).filter((row): row is RecruitmentTemplate => !!row);
}

export async function getRecruitmentTemplate(id: string): Promise<RecruitmentTemplate | null> {
  const row = await prisma.activityEvent.findFirst({
    where: { documentType: DOCUMENT_TYPE, documentId: id, type: "SAVED" },
  });
  return row ? read(row.description) : null;
}

export async function saveRecruitmentTemplate(input: RecruitmentTemplate): Promise<RecruitmentTemplate> {
  const existing = await prisma.activityEvent.findFirst({
    where: { documentType: DOCUMENT_TYPE, documentId: input.id },
  });
  if (existing) {
    await prisma.activityEvent.update({
      where: { id: existing.id },
      data: { description: JSON.stringify(input), type: "SAVED" },
    });
  } else {
    await prisma.activityEvent.create({
      data: {
        documentType: DOCUMENT_TYPE,
        documentId: input.id,
        type: "SAVED",
        actor: "STAFF",
        description: JSON.stringify(input),
      },
    });
  }
  return input;
}

export async function deleteRecruitmentTemplate(id: string) {
  await prisma.activityEvent.deleteMany({
    where: { documentType: DOCUMENT_TYPE, documentId: id },
  });
}
