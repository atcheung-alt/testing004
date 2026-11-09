import { multiplierProduct, MultiplierFactor } from "@/lib/multipliers";
import { feesTotal, Fee } from "@/lib/fees";

export type LineItemInput = {
  quantity: number;
  unitPrice: number;
  // Zero or more user-added multiplier factors (e.g. "× 3 persons"). See
  // src/lib/multipliers.ts. amount = quantity * unitPrice * product(values).
  multipliers?: MultiplierFactor[];
  // Zero or more named extra charges (e.g. a transportation fee) — each
  // one's amount adds on top of the base amount above when computing this
  // line's contribution to the document subtotal. See QuotationItem.fees.
  fees?: Fee[];
};

export type Totals = {
  // The raw sum of every line item (base amount + fees), before the repeat
  // multiplier is applied — same value as `subtotal` whenever repeatCount
  // is 1 (the overwhelming majority of documents, and every Invoice, which
  // has no repeat concept at all). Exposed separately so callers can show a
  // "Subtotal (per session) × N = Subtotal" breakdown without re-deriving
  // it via division (which would reintroduce floating-point rounding).
  rawSubtotal: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

/** Round to 2dp, avoiding floating point noise. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineAmount(item: LineItemInput): number {
  const factor = multiplierProduct(item.multipliers ?? []);
  return round2((Number(item.quantity) || 0) * factor * (Number(item.unitPrice) || 0));
}

/**
 * A line's full contribution to the document subtotal — its base amount
 * (quantity × unit price × multipliers) plus its optional additional fee.
 * Kept separate from `lineAmount` because the base amount is still stored
 * and displayed on its own (the fee is shown as its own line/column so the
 * client can see what it's for) — this combined figure is only used where
 * a single "what does this row add up to" number is needed: the subtotal
 * calculation below, and the display helper further down.
 */
function lineTotal(item: LineItemInput): number {
  return round2(lineAmount(item) + feesTotal(item.fees ?? []));
}

/**
 * `repeatCount` (default 1, i.e. no repeat) is a whole-document multiplier
 * for quotations covering work conducted several times (e.g. a training
 * session run 3 times) — it multiplies the raw item subtotal before
 * Discount/Tax apply, same order those already use relative to each other.
 * Invoices never pass this (always the default 1), since they have no
 * repeat concept of their own.
 */
export function computeTotals(
  items: LineItemInput[],
  taxRate: number,
  discount: number,
  repeatCount: number = 1
): Totals {
  const rawSubtotal = round2(items.reduce((sum, item) => sum + lineTotal(item), 0));
  const subtotal = round2(rawSubtotal * (Number(repeatCount) || 1));
  const discounted = round2(Math.max(subtotal - (Number(discount) || 0), 0));
  const taxAmount = round2((discounted * (Number(taxRate) || 0)) / 100);
  const total = round2(discounted + taxAmount);
  return { rawSubtotal, subtotal, taxAmount, total };
}

/**
 * Display helper for already-*stored* items (which carry a precomputed
 * `amount` rather than raw quantity/unitPrice/multipliers) — the same
 * "base + fees" total as lineTotal() above, used by DocumentItemsTable and
 * the PDF templates so a row's displayed total always matches what it
 * actually contributed to the subtotal.
 */
export function lineTotalWithFee(item: { amount: number; fees?: Fee[] | null }): number {
  return round2((Number(item.amount) || 0) + feesTotal(item.fees ?? []));
}

import { COMPANY } from "@/lib/company";

/** Billing starts as the invoice total minus the expenses recorded on that invoice. */
export function billingDefaultAmount(itemTotal: number, expenseTotal: number): number {
  const net = round2((Number(itemTotal) || 0) - (Number(expenseTotal) || 0));
  return net > 0 ? net : 0;
}

export function billingFormula(itemTotal: number, expenseTotal: number): string {
  const net = billingDefaultAmount(itemTotal, expenseTotal);
  return `${formatCurrency(itemTotal)} − ${formatCurrency(expenseTotal)} = ${formatCurrency(net)}`;
}

export function formatCurrency(amount: number, currency: string = COMPANY.currency): string {
  return new Intl.NumberFormat(COMPANY.currencyLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/** DD/MM/YYYY — the standard date format across the whole app. */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Date + time, e.g. "21/07/2026, 3:04 PM" — used on the activity timeline. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${formatDate(d)}, ${time}`;
}
