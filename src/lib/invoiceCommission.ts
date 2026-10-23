import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { bindShareColleagueNames, loadCreatorNickname } from "@/lib/quotationAuthor";
import {
  COMMISSION_TOTAL_NAME,
  SHARE_HOLDER_PREFIX,
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
  if (!Number.isFinite(commissionTotal) || commissionTotal < 0) return "Enter the total commission.";
  const sharing = quotationShareFieldsFrom({ ...body, shareMode: "PERCENT" });
  if (sharing.error) return sharing.error;
  const assigned = sharing.shares.reduce((sum, share) => sum + share.value, 0);
  if (assigned > 100) return "Partner percentages can't add up to more than 100.";
  return null;
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
