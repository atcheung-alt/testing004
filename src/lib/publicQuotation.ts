import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { normalizeMultipliers, MultiplierFactor } from "@/lib/multipliers";
import { normalizeFees, Fee } from "@/lib/fees";
import { logClientView } from "@/lib/activity";
import { computeTotals } from "@/lib/calculations";

export type PublicQuotationView = {
  id: string;
  number: string;
  title: string;
  status: string;
  issueDate: string;
  expiryDate: string | null;
  customer: {
    name: string;
    contact: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  items: {
    name: string;
    description: string;
    imageData: string | null;
    unit: string;
    quantity: number;
    multipliers: MultiplierFactor[];
    unitPrice: number;
    amount: number;
    duration: string | null;
    fees: Fee[];
  }[];
  subtotal: number;
  // Quotation-only whole-document multiplier (e.g. a training run 3 times)
  // — repeatCount/rawSubtotal let the page show "Subtotal (per session) ×
  // N = Subtotal"; repeatCount is 1 (rawSubtotal === subtotal) for any
  // quotation that isn't repeated.
  repeatCount: number;
  rawSubtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  reminder: string | null;
  signed: boolean;
  signable: boolean;
  signatureData: string | null;
  signedDocumentName: string | null;
  hasSignedDocument: boolean;
  signerName: string | null;
  signedAt: string | null;
  comments: {
    id: string;
    author: string;
    authorName: string;
    message: string;
    createdAt: string;
  }[];
  company: {
    name: string;
    shortName?: string;
    logoData?: string | null;
    logoDataDark?: string | null;
    currency?: string;
    currencyLocale?: string;
    contact?: { name?: string; title?: string; tel?: string; email?: string };
  };
};

/**
 * Token-scoped, read-only quotation view shared by the public API route and
 * the /sign/[token] page's server-side initial render. No authentication —
 * the random signing token is the access control.
 */
export async function getPublicQuotationView(token: string): Promise<PublicQuotationView | null> {
  const quotation = await prisma.quotation.findUnique({
    where: { signingToken: token },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!quotation) return null;

  await logClientView("quotation", quotation.id);

  const locked = quotation.status === "CONVERTED";
  const company = await getEffectiveCompany(quotation.companyId);
  const items = quotation.items.map((i) => ({
    name: i.name,
    description: i.description,
    imageData: i.imageData,
    unit: i.unit,
    quantity: i.quantity,
    multipliers: normalizeMultipliers(i.multipliers),
    unitPrice: i.unitPrice,
    amount: i.amount,
    duration: i.duration,
    fees: normalizeFees(i.fees),
  }));

  return {
    id: quotation.id,
    number: quotation.number,
    title: quotation.title,
    status: quotation.status,
    issueDate: quotation.issueDate.toISOString(),
    expiryDate: quotation.expiryDate ? quotation.expiryDate.toISOString() : null,
    customer: {
      name: quotation.customerName,
      contact: quotation.customerContact,
      email: quotation.customerEmail,
      phone: quotation.customerPhone,
      address: quotation.customerAddress,
    },
    items,
    subtotal: quotation.subtotal,
    repeatCount: quotation.repeatCount,
    rawSubtotal: computeTotals(items, quotation.taxRate, quotation.discount, quotation.repeatCount)
      .rawSubtotal,
    discount: quotation.discount,
    taxRate: quotation.taxRate,
    taxAmount: quotation.taxAmount,
    total: quotation.total,
    notes: quotation.notes,
    terms: quotation.terms,
    reminder: quotation.reminder,
    signed: Boolean(quotation.signedAt),
    signable: !locked && !quotation.signedAt,
    signatureData: quotation.signatureData,
    signedDocumentName: quotation.signedDocumentName,
    hasSignedDocument: Boolean(quotation.signedDocumentData),
    signerName: quotation.signerName,
    signedAt: quotation.signedAt ? quotation.signedAt.toISOString() : null,
    comments: quotation.comments.map((c) => ({
      id: c.id,
      author: c.author,
      authorName: c.authorName,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
    })),
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      logoDataDark: company.logoDataDark,
      currency: company.currency,
      currencyLocale: company.currencyLocale,
      contact: company.contact,
    },
  };
}
