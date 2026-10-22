/** Quotations with this number prefix only store an invoice's colleague split.
 *  They are not shown in the quotation list. */
export const SHARE_HOLDER_PREFIX = "QS-";

export function isShareHolderNumber(number: string): boolean {
  return number.startsWith(SHARE_HOLDER_PREFIX);
}

/** Stored as a share row so the commission total needs no new database column.
 *  It is not a person, and it never grants access to the invoice. */
export const COMMISSION_TOTAL_NAME = "#commission";

export function isCommissionTotalRow(colleagueName: string): boolean {
  return colleagueName.trim() === COMMISSION_TOTAL_NAME;
}

export const SHARE_MODES = ["AMOUNT", "PERCENT", "COMMISSION"] as const;
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

export type CommissionSplit = {
  total: number;
  partners: { colleagueName: string; percent: number }[];
};

/** Turn saved share rows into a commission total plus each partner's percentage of it.
 *  Older rows that were an amount, or a percentage of the invoice, are converted. */
export function commissionSplitFromStored(
  shareMode: string,
  shares: { colleagueName: string; value: number }[],
  invoiceTotal: number
): CommissionSplit {
  const pool = shares.find((share) => isCommissionTotalRow(share.colleagueName));
  const people = shares.filter((share) => share.colleagueName.trim() && !isCommissionTotalRow(share.colleagueName));
  if (shareMode === "COMMISSION" && pool) {
    return {
      total: pool.value,
      partners: people.map((share) => ({ colleagueName: share.colleagueName, percent: share.value })),
    };
  }
  const amounts = people.map((share) => ({
    colleagueName: share.colleagueName,
    amount: shareMode === "PERCENT" ? (invoiceTotal * share.value) / 100 : share.value,
  }));
  const total = amounts.reduce((sum, row) => sum + row.amount, 0);
  return {
    total,
    partners: amounts.map((row) => ({
      colleagueName: row.colleagueName,
      percent: total > 0 ? Math.round((row.amount / total) * 1000) / 10 : 0,
    })),
  };
}
