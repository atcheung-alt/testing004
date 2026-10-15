import { prisma } from "@/lib/prisma";

export type MonthlyFinance = {
  month: string; // "2026-07", sortable
  label: string; // "Jul 2026", for display
  revenue: number;
  expenses: number;
  profit: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(date);
}

/**
 * Revenue and its matching expenses are both bucketed by `paidAt` — the
 * moment an invoice actually became PAID — not by issueDate. That means a
 * given month's numbers reflect money that actually landed that month, and
 * expenses only count against a month once its matching revenue has been
 * recognized. Invoices that are still unpaid (and any expenses logged
 * against them) don't count toward any month yet.
 *
 * Returns exactly `monthsBack` entries, oldest first, ending with the
 * current calendar month — including months with no paid invoices at all,
 * so a chart/table built from this never skips a quiet month.
 */
export async function getMonthlyFinance(monthsBack: number): Promise<MonthlyFinance[]> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (monthsBack - 1));

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: { gte: since } },
    select: { total: true, paidAt: true, expenses: { select: { amount: true } } },
  });

  const buckets = new Map<string, MonthlyFinance>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    const key = monthKey(d);
    buckets.set(key, { month: key, label: monthLabel(d), revenue: 0, expenses: 0, profit: 0 });
  }

  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const bucket = buckets.get(monthKey(inv.paidAt));
    if (!bucket) continue; // shouldn't happen given the query filter above
    bucket.revenue += inv.total;
    bucket.expenses += inv.expenses.reduce((sum, e) => sum + e.amount, 0);
  }

  const result = Array.from(buckets.values());
  for (const b of result) b.profit = b.revenue - b.expenses;
  return result;
}

/** Same shape as MonthlyFinance, reused for day-level (week/month view) buckets too. */
export type FinanceBucket = MonthlyFinance;

export type FinanceGranularity = "week" | "month" | "year";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function dayLabel(date: Date, withWeekday: boolean, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: withWeekday ? "short" : undefined,
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Monday-start week containing `date`, at midnight. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

type PeriodRange = {
  rangeStart: Date;
  rangeEndExclusive: Date;
  rangeLabel: string;
  bucketKeyFor: (date: Date) => string;
  emptyBuckets: FinanceBucket[];
};

/** Shared by getFinanceByPeriod, getPeriodTotals, and the "previous period" comparison. */
function periodRange(granularity: FinanceGranularity, referenceDate: Date, locale = "en-US"): PeriodRange {
  if (granularity === "week") {
    const rangeStart = startOfWeek(referenceDate);
    const rangeEndExclusive = new Date(rangeStart);
    rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 7);
    const emptyBuckets: FinanceBucket[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      emptyBuckets.push({ month: dayKey(d), label: dayLabel(d, true, locale), revenue: 0, expenses: 0, profit: 0 });
    }
    const rangeEndInclusive = new Date(rangeEndExclusive);
    rangeEndInclusive.setDate(rangeEndInclusive.getDate() - 1);
    return {
      rangeStart,
      rangeEndExclusive,
      rangeLabel: `${dayLabel(rangeStart, false, locale)} – ${dayLabel(rangeEndInclusive, false, locale)}, ${rangeStart.getFullYear()}`,
      bucketKeyFor: dayKey,
      emptyBuckets,
    };
  }
  if (granularity === "month") {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const rangeStart = new Date(year, month, 1);
    const rangeEndExclusive = new Date(year, month + 1, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const emptyBuckets: FinanceBucket[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      emptyBuckets.push({ month: dayKey(d), label: String(i), revenue: 0, expenses: 0, profit: 0 });
    }
    return {
      rangeStart,
      rangeEndExclusive,
      rangeLabel: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(rangeStart),
      bucketKeyFor: dayKey,
      emptyBuckets,
    };
  }
  const year = referenceDate.getFullYear();
  const rangeStart = new Date(year, 0, 1);
  const rangeEndExclusive = new Date(year + 1, 0, 1);
  const emptyBuckets: FinanceBucket[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    emptyBuckets.push({ month: monthKey(d), label: monthLabel(d, locale), revenue: 0, expenses: 0, profit: 0 });
  }
  return { rangeStart, rangeEndExclusive, rangeLabel: String(year), bucketKeyFor: monthKey, emptyBuckets };
}

/** Shift a reference date back exactly one period of the given granularity. */
export function previousReferenceDate(granularity: FinanceGranularity, referenceDate: Date): Date {
  const d = new Date(referenceDate);
  if (granularity === "week") d.setDate(d.getDate() - 7);
  else if (granularity === "month") d.setMonth(d.getMonth() - 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

/**
 * Flexible version of getMonthlyFinance for the Analysis page: shows a
 * specific week (bucketed by day), a specific month (bucketed by day), or a
 * specific year (bucketed by month) — rather than always "the last N months
 * from today". Same paidAt-based accounting as getMonthlyFinance (see its
 * comment) applies here too.
 */
export async function getFinanceByPeriod(
  granularity: FinanceGranularity,
  referenceDate: Date,
  locale = "en-US"
): Promise<{ buckets: FinanceBucket[]; rangeLabel: string }> {
  const { rangeStart, rangeEndExclusive, rangeLabel, bucketKeyFor, emptyBuckets } = periodRange(
    granularity,
    referenceDate,
    locale
  );

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
    select: { total: true, paidAt: true, expenses: { select: { amount: true } } },
  });

  const bucketMap = new Map(emptyBuckets.map((b) => [b.month, b]));
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const bucket = bucketMap.get(bucketKeyFor(inv.paidAt));
    if (!bucket) continue; // shouldn't happen given the query's own date range filter
    bucket.revenue += inv.total;
    bucket.expenses += inv.expenses.reduce((sum, e) => sum + e.amount, 0);
  }
  for (const b of emptyBuckets) b.profit = b.revenue - b.expenses;

  return { buckets: emptyBuckets, rangeLabel };
}

export type PeriodTotals = { revenue: number; expenses: number; profit: number; rangeLabel: string };

/** Aggregate totals (no day/month bucketing) for one period — used for the
 *  headline summary cards and for comparing against the previous period. */
export async function getPeriodTotals(
  granularity: FinanceGranularity,
  referenceDate: Date,
  locale = "en-US"
): Promise<PeriodTotals> {
  const { rangeStart, rangeEndExclusive, rangeLabel } = periodRange(granularity, referenceDate, locale);
  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
    select: { total: true, expenses: { select: { amount: true } } },
  });
  const revenue = invoices.reduce((sum, i) => sum + i.total, 0);
  const expenses = invoices.reduce((sum, i) => sum + i.expenses.reduce((s, e) => s + e.amount, 0), 0);
  return { revenue, expenses, profit: revenue - expenses, rangeLabel };
}

/** Percent change from `previous` to `current`; null if previous is 0 (undefined %, avoid divide-by-zero). */
export function percentChange(previous: number, current: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type ExpenseCategoryBreakdown = {
  category: string;
  amount: number;
  pctOfRevenue: number | null; // null if revenue is 0 for the period
};

/** Vertical analysis: each expense category's amount and its % of the period's revenue. */
export async function getExpenseBreakdown(
  granularity: FinanceGranularity,
  referenceDate: Date
): Promise<{ revenue: number; categories: ExpenseCategoryBreakdown[] }> {
  const { rangeStart, rangeEndExclusive } = periodRange(granularity, referenceDate);
  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
    select: { total: true, expenses: { select: { category: true, amount: true } } },
  });
  const revenue = invoices.reduce((sum, i) => sum + i.total, 0);

  const byCategory = new Map<string, number>();
  for (const inv of invoices) {
    for (const e of inv.expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
  }

  const categories = Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      pctOfRevenue: revenue === 0 ? null : (amount / revenue) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { revenue, categories };
}

/** The one budget row for a given calendar month, or null if none has been set. */
export async function getBudget(year: number, month: number) {
  return prisma.budget.findUnique({ where: { year_month: { year, month } } });
}

export async function upsertBudget(
  year: number,
  month: number,
  targetRevenue: number,
  targetExpenses: number
) {
  return prisma.budget.upsert({
    where: { year_month: { year, month } },
    create: { year, month, targetRevenue, targetExpenses },
    update: { targetRevenue, targetExpenses },
  });
}

export type ArAgingBucket = { label: string; amount: number; count: number };
export type ArInvoice = {
  id: string;
  number: string;
  customerName: string;
  total: number;
  dueDate: string | null;
  daysOutstanding: number;
  status: string;
};

/**
 * Accounts Receivable summary — a real, derivable stand-in for a balance
 * sheet's AR line, not a full balance sheet (this app has no concept of
 * cash balances, fixed assets, liabilities, or equity, so a true balance
 * sheet isn't possible from this data). Includes every invoice that's
 * UNPAID, OVERDUE (computed from due date), or PENDING_VERIFICATION —
 * i.e. every dollar a client currently owes that hasn't been confirmed
 * paid yet.
 */
export async function getAccountsReceivable(): Promise<{
  total: number;
  buckets: ArAgingBucket[];
  invoices: ArInvoice[];
}> {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["UNPAID", "PENDING_VERIFICATION"] } },
    orderBy: { dueDate: "asc" },
    select: { id: true, number: true, customerName: true, total: true, dueDate: true, status: true },
  });

  const now = Date.now();
  const bucketDefs = [
    { label: "Not yet due", max: 0 },
    { label: "0–30 days", max: 30 },
    { label: "31–60 days", max: 60 },
    { label: "61–90 days", max: 90 },
    { label: "90+ days", max: Infinity },
  ];
  const buckets: ArAgingBucket[] = bucketDefs.map((b) => ({ label: b.label, amount: 0, count: 0 }));

  const arInvoices: ArInvoice[] = invoices.map((inv) => {
    const daysOutstanding = inv.dueDate
      ? Math.floor((now - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    let bucketIndex = 0;
    if (daysOutstanding > 0) {
      bucketIndex = daysOutstanding <= 30 ? 1 : daysOutstanding <= 60 ? 2 : daysOutstanding <= 90 ? 3 : 4;
    }
    buckets[bucketIndex].amount += inv.total;
    buckets[bucketIndex].count += 1;
    return {
      id: inv.id,
      number: inv.number,
      customerName: inv.customerName,
      total: inv.total,
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      daysOutstanding,
      status: inv.status,
    };
  });

  return {
    total: invoices.reduce((sum, i) => sum + i.total, 0),
    buckets,
    invoices: arInvoices,
  };
}

/** Convenience for "this calendar month" figures shown on the dashboard. */
export async function getCurrentMonthFinance(): Promise<MonthlyFinance> {
  const [current] = await getMonthlyFinance(1);
  return current;
}
