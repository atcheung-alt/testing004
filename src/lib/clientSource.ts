import { prisma } from "@/lib/prisma";

export const CLIENT_SOURCES = [
  "LinkedIn / Social Media",
  "Client Referral",
  "Internal Referral / Staff",
  "Cold Call / Email Outreach",
  "Website / Inbound Inquiry",
  "Job Board / Candidate Network",
  "Industry Event / Exhibition",
  "Other (Custom)",
] as const;

const TYPE = "CLIENT_SOURCE";

export function clientSourceFrom(body: { clientSource?: unknown; clientSourceOther?: unknown }) {
  const picked = String(body.clientSource || "").trim();
  if (!picked) return "";
  if (picked === "Other (Custom)") return String(body.clientSourceOther || "").trim();
  return picked;
}

export async function saveClientSource(invoiceId: string, source: string) {
  const value = source.trim();
  const existing = await prisma.activityEvent.findFirst({
    where: { documentType: "invoice", documentId: invoiceId, type: TYPE },
  });
  if (!value) {
    if (existing) await prisma.activityEvent.delete({ where: { id: existing.id } });
    return;
  }
  if (existing) {
    await prisma.activityEvent.update({ where: { id: existing.id }, data: { description: value } });
    return;
  }
  await prisma.activityEvent.create({
    data: { documentType: "invoice", documentId: invoiceId, type: TYPE, actor: "STAFF", description: value },
  });
}

export async function loadClientSource(invoiceId: string) {
  const row = await prisma.activityEvent.findFirst({
    where: { documentType: "invoice", documentId: invoiceId, type: TYPE },
  });
  return row?.description || "";
}

export async function loadClientSources(invoiceIds: string[]) {
  const map = new Map<string, string>();
  if (!invoiceIds.length) return map;
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", documentId: { in: invoiceIds }, type: TYPE },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    if (!map.has(row.documentId)) map.set(row.documentId, row.description);
  }
  return map;
}
