import { prisma } from "@/lib/prisma";
import { billingDefaultAmount, round2 } from "@/lib/calculations";
import { logActivity } from "@/lib/activity";
import { commissionMarkDescription, parseCommissionMark } from "@/lib/commission";
import { bindShareColleagueNames, loadCreatorNickname } from "@/lib/quotationAuthor";
import {
  COMMISSION_TOTAL_NAME,
  SHARE_HOLDER_PREFIX,
  isCommissionTotalRow,
  isShareHolderNumber,
  quotationShareFieldsFrom,
} from "@/lib/quotationShares";

type SplitBody = {
  commissionTotal?: unknown;
  shares?: unknown;
};

type InvoiceForSplit = {
  id: string;
  number: string;
  title: string;
  customerName: string;
  customerContact: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  quotationId: string | null;
  quotation: { number: string; preparedBy: string | null } | null;
};

/** True when the create form actually entered a commission or a partner. */
export function commissionSplitRequested(body: SplitBody): boolean {
  const total = Number(body.commissionTotal);
  const shares = Array.isArray(body.shares) ? body.shares : [];
  const hasPartner = shares.some((row) => {
    const name = typeof row?.colleagueName === "string" ? row.colleagueName.trim() : "";
    return Boolean(name) || Number(row?.value) > 0;
  });
  return (Number.isFinite(total) && total > 0) || hasPartner;
}

export function commissionSplitError(body: SplitBody): string | null {
  const commissionTotal = Number(body.commissionTotal);
  if (!Number.isFinite(commissionTotal) || commissionTotal < 0) return "Enter the total billing.";
  const sharing = quotationShareFieldsFrom({ ...body, shareMode: "PERCENT" });
  if (sharing.error) return sharing.error;
  const assigned = sharing.shares.reduce((sum, share) => sum + share.value, 0);
  if (assigned > 100) return "Partner percentages can't add up to more than 100.";
  return null;
}

/**
 * When billing is still the default, an expense added later — on the invoice
 * or linked from the Expenses page — moves the saved amount to items minus expenses.
 * A billing amount the user typed themselves is left as it is.
 */
export async function refreshBillingAfterExpense(invoiceId: string, delta = 0): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      total: true,
      number: true,
      expenses: { select: { amount: true } },
      quotation: {
        select: {
          shareMode: true,
          shares: { select: { id: true, colleagueName: true, value: true } },
        },
      },
    },
  });
  if (!invoice?.quotation || invoice.quotation.shareMode !== "COMMISSION") return;
  const pool = invoice.quotation.shares.find((share) => isCommissionTotalRow(share.colleagueName));
  if (!pool) return;
  let generalSum = 0;
  try {
    const rows = await prisma.generalExpense.findMany({
      where: { OR: [{ invoiceId }, { invoiceNumber: invoice.number }] },
      select: { amount: true },
    });
    generalSum = rows.reduce((sum, row) => sum + row.amount, 0);
  } catch {
    generalSum = 0;
  }
  const invoiceSum = invoice.expenses.reduce((sum, row) => sum + row.amount, 0);
  const all = invoiceSum + generalSum;
  const next = billingDefaultAmount(invoice.total, all);
  const saved = round2(pool.value);
  const baselines = [
    billingDefaultAmount(invoice.total, all - delta),
    billingDefaultAmount(invoice.total, invoiceSum),
  ].map((value) => round2(value));
  if (!baselines.includes(saved) || saved === next) return;
  await prisma.quotationShare.update({ where: { id: pool.id }, data: { value: next } });
}

/** Write the commission split onto the invoice's hidden share holder. */
export async function saveInvoiceCommissionSplit(invoice: InvoiceForSplit, body: SplitBody): Promise<void> {
  const commissionTotal = Number(body.commissionTotal);
  const sharing = quotationShareFieldsFrom({ ...body, shareMode: "PERCENT" });
  const boundShares = await bindShareColleagueNames(sharing.shares);
  const preparedBy = (await invoiceCreatorName(invoice)) || invoice.quotation?.preparedBy || "";
  const quotationId = invoice.quotationId || (await ensureShareHolder(invoice));
  await prisma.$transaction(async (tx) => {
    await tx.quotationShare.deleteMany({ where: { quotationId } });
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        preparedBy,
        shareMode: "COMMISSION",
        shares: {
          create: [
            { colleagueName: COMMISSION_TOTAL_NAME, value: commissionTotal, sortOrder: 0 },
            ...boundShares.map((share, index) => ({ ...share, sortOrder: index + 1 })),
          ],
        },
      },
    });
  });
  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "EDITED",
    description: "Colleague split updated",
  });
}

async function invoiceCreatorName(invoice: { id: string; quotationId: string | null; quotation: { number: string } | null }) {
  const fromInvoice = await loadCreatorNickname("invoice", invoice.id);
  if (fromInvoice) return fromInvoice;
  if (invoice.quotationId && invoice.quotation && !isShareHolderNumber(invoice.quotation.number)) {
    return loadCreatorNickname("quotation", invoice.quotationId);
  }
  return "";
}

async function ensureShareHolder(invoice: {
  id: string;
  number: string;
  title: string;
  customerName: string;
  customerContact: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
}) {
  const number = `${SHARE_HOLDER_PREFIX}${invoice.number}`;
  const existing = await prisma.quotation.findUnique({ where: { number }, select: { id: true } });
  const quotation =
    existing ||
    (await prisma.quotation.create({
      data: {
        number,
        title: invoice.title,
        customerName: invoice.customerName,
        customerContact: invoice.customerContact,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        customerAddress: invoice.customerAddress,
        status: "CONVERTED",
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discount: invoice.discount,
        total: invoice.total,
      },
      select: { id: true },
    }));
  await prisma.invoice.update({ where: { id: invoice.id }, data: { quotationId: quotation.id } });
  return quotation.id;
}

export type CommissionMark = { workKind: "EVENT" | "RECRUITMENT"; day: string };

/** Keep the type and date on an activity row the invoice timeline already uses.
 *  The type stays once it is set. The date can change. No invoice column is added. */
export async function saveCommissionMark(invoiceId: string, workKind: string, day: string): Promise<void> {
  const existing = await prisma.activityEvent.findFirst({
    where: { documentType: "invoice", documentId: invoiceId, type: "COMMISSION" },
    orderBy: { createdAt: "desc" },
  });
  const locked = existing ? parseCommissionMark(existing.description) : null;
  const description = commissionMarkDescription(locked?.workKind || workKind, day);
  if (existing) {
    if (existing.description !== description) {
      await prisma.activityEvent.update({ where: { id: existing.id }, data: { description } });
    }
    return;
  }
  await prisma.activityEvent.create({
    data: {
      documentType: "invoice",
      documentId: invoiceId,
      type: "COMMISSION",
      actor: "SYSTEM",
      description,
    },
  });
}

export async function loadCommissionMarks(invoiceIds: string[]): Promise<Map<string, CommissionMark>> {
  const marks = new Map<string, CommissionMark>();
  if (!invoiceIds.length) return marks;
  const rows = await prisma.activityEvent.findMany({
    where: { documentType: "invoice", documentId: { in: invoiceIds }, type: "COMMISSION" },
    select: { documentId: true, description: true },
    orderBy: { createdAt: "asc" },
  });
  rows.forEach((row) => {
    const parsed = parseCommissionMark(row.description);
    if (parsed) marks.set(row.documentId, parsed);
  });
  return marks;
}

export async function loadCommissionMark(invoiceId: string): Promise<CommissionMark | null> {
  const marks = await loadCommissionMarks([invoiceId]);
  return marks.get(invoiceId) || null;
}
