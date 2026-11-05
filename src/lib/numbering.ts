import { prisma } from "@/lib/prisma";

/**
 * Generates the next sequential document number for the given year, e.g. QT-2026-0007.
 * Looks at the highest existing number for that year+prefix and increments it.
 */
export async function nextDocumentNumber(
  kind: "quotation" | "invoice" | "receipt" | "recruitment"
): Promise<string> {
  const prefix =
    kind === "quotation" ? "QT" : kind === "invoice" ? "INV" : kind === "receipt" ? "RE" : "RA";
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-`;

  const rows =
    kind === "quotation"
      ? await prisma.quotation.findMany({
          where: { number: { startsWith: pattern } },
          select: { number: true },
        })
      : kind === "invoice"
      ? await prisma.invoice.findMany({
          where: { number: { startsWith: pattern } },
          select: { number: true },
        })
      : kind === "receipt"
      ? await prisma.receipt.findMany({
          where: { number: { startsWith: pattern } },
          select: { number: true },
        })
      : await prisma.recruitmentAgreement.findMany({
          where: { number: { startsWith: pattern } },
          select: { number: true },
        });

  let maxSeq = 0;
  for (const row of rows) {
    const seqStr = row.number.slice(pattern.length);
    const seq = parseInt(seqStr, 10);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  const next = String(maxSeq + 1).padStart(4, "0");
  return `${pattern}${next}`;
}
