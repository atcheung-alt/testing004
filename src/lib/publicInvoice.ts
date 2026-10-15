import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { normalizeMultipliers, MultiplierFactor } from "@/lib/multipliers";
import { normalizeFees, Fee } from "@/lib/fees";
import { logClientView } from "@/lib/activity";

export type PublicInvoiceView = {
  id: string;
  number: string;
  title: string;
  poNumber: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
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
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentDueDays: number;
  notes: string | null;
  terms: string | null;
  reminder: string | null;
  /** Whether "Mark as Paid" can currently be submitted. */
  payable: boolean;
  /** Client already clicked "Mark as Paid" and it's awaiting HR verification. */
  pendingVerification: boolean;
  paymentSubmittedAt: string | null;
  paid: boolean;
  receiptNumber: string | null;
  company: {
    name: string;
    shortName?: string;
    logoData?: string | null;
    logoDataDark?: string | null;
    address?: string;
    website?: string;
    currency?: string;
    currencyLocale?: string;
    contact?: { name?: string; title?: string; tel?: string; email?: string };
  };
};

/**
 * Token-scoped, read-only invoice view shared by the public API route and
 * the /invoice/[token] page's server-side initial render. No authentication
 * — the random view token itself is the access control.
 */
export async function getPublicInvoiceView(token: string): Promise<PublicInvoiceView | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { viewToken: token },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      receipt: { select: { number: true } },
    },
  });
  if (!invoice) return null;

  await logClientView("invoice", invoice.id);
  const company = await getEffectiveCompany();

  return {
    id: invoice.id,
    number: invoice.number,
    title: invoice.title,
    poNumber: invoice.poNumber,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    customer: {
      name: invoice.customerName,
      contact: invoice.customerContact,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      address: invoice.customerAddress,
    },
    items: invoice.items.map((i) => ({
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
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    paymentDueDays: invoice.paymentDueDays,
    notes: invoice.notes,
    terms: invoice.terms,
    reminder: invoice.reminder,
    payable: invoice.status === "UNPAID",
    pendingVerification: invoice.status === "PENDING_VERIFICATION",
    paymentSubmittedAt: invoice.paymentSubmittedAt
      ? invoice.paymentSubmittedAt.toISOString()
      : null,
    paid: invoice.status === "PAID",
    receiptNumber: invoice.receipt?.number || null,
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      logoDataDark: company.logoDataDark,
      address: company.address,
      website: company.website,
      currency: company.currency,
      currencyLocale: company.currencyLocale,
      contact: company.contact,
    },
  };
}
