/** Quotations with this number prefix only store an invoice's colleague split.
 *  They are not shown in the quotation list. */
export const SHARE_HOLDER_PREFIX = "QS-";

export function isShareHolderNumber(number: string): boolean {
  return number.startsWith(SHARE_HOLDER_PREFIX);
}

export const SHARE_MODES = ["AMOUNT", "PERCENT"] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export type QuotationShareInput = {
  colleagueName: string;
  value: number;
  sortOrder: number;
};

export type QuotationShareFields = {
  preparedBy: string;
  shareMode: ShareMode;
  shares: QuotationShareInput[];
  error: string | null;
};

/** Pull "made by" and colleague profit-sharing rows off a quotation save. */
export function quotationShareFieldsFrom(body: {
  preparedBy?: unknown;
  shareMode?: unknown;
  shares?: unknown;
}): QuotationShareFields {
  const preparedBy =
    typeof body.preparedBy === "string" ? body.preparedBy.trim().slice(0, 80) : "";
  const shareMode: ShareMode = body.shareMode === "PERCENT" ? "PERCENT" : "AMOUNT";

  if (body.shares === undefined) {
    return { preparedBy, shareMode, shares: [], error: null };
  }
  if (!Array.isArray(body.shares)) {
    return { preparedBy, shareMode, shares: [], error: "Colleague shares must be a list." };
  }

  const shares: QuotationShareInput[] = [];
  for (const row of body.shares) {
    const colleagueName =
      typeof row?.colleagueName === "string" ? row.colleagueName.trim().slice(0, 80) : "";
    const value = Number(row?.value);
    if (!colleagueName && !(value > 0)) continue;
    if (!colleagueName) {
      return {
        preparedBy,
        shareMode,
        shares: [],
        error: "Each colleague share needs a name.",
      };
    }
    if (!Number.isFinite(value) || value < 0) {
      return {
        preparedBy,
        shareMode,
        shares: [],
        error: "Share amounts and percentages can't be negative.",
      };
    }
    if (shareMode === "PERCENT" && value > 100) {
      return {
        preparedBy,
        shareMode,
        shares: [],
        error: "A share percentage can't be more than 100.",
      };
    }
    shares.push({ colleagueName, value, sortOrder: shares.length });
  }

  return { preparedBy, shareMode, shares, error: null };
}
