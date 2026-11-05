import { prisma } from "@/lib/prisma";
import { hongKongDay } from "@/lib/commission";

const TYPE = "COMMISSION_PAID";

function paidKey(colleagueName: string): string {
  return colleagueName.trim();
}

export async function loadCommissionPaid(invoiceIds: string[]): Promise<Map<string, string>> {
  const paid = new Map<string, string>();
  if (!invoiceIds.length) return paid;
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", documentId: { in: invoiceIds }, type: TYPE },
    select: { documentId: true, description: true },
  });
  rows.forEach((row) => {
    const [name, day] = String(row.description || "").split("\n");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return;
    paid.set(`${row.documentId}\n${name.trim()}`, day);
  });
  return paid;
}

export async function setCommissionPaid(invoiceId: string, colleagueName: string, paid: boolean): Promise<string> {
  const name = paidKey(colleagueName);
  const existing = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", documentId: invoiceId, type: TYPE },
    select: { id: true, description: true },
  });
  const match = existing.filter((row) => String(row.description || "").split("\n")[0].trim() === name);
  if (!paid) {
    if (match.length) await prisma.activityEvent.deleteMany({ where: { id: { in: match.map((row) => row.id) } } });
    return "";
  }
  const day = hongKongDay(new Date());
  const description = `${name}\n${day}`;
  if (match[0]) {
    await prisma.activityEvent.update({ where: { id: match[0].id }, data: { description } });
    if (match.length > 1) await prisma.activityEvent.deleteMany({ where: { id: { in: match.slice(1).map((row) => row.id) } } });
    return day;
  }
  await prisma.activityEvent.create({
    data: { documentType: "invoice", documentId: invoiceId, type: TYPE, actor: "STAFF", description },
  });
  return day;
}
