import { prisma } from "@/lib/prisma";
import { generalExpensesBetween, sumGeneralExpenses } from "@/lib/generalExpense";
import { hongKongDay } from "@/lib/commission";
import { loadCommissionMarks } from "@/lib/invoiceCommission";

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

type ServiceInvoice = { total: number; month: string; day: string; status: string };

const OPEN_INVOICE = new Set(["UNPAID", "OVERDUE", "PENDING_VERIFICATION"]);

function settlement(invoices: ServiceInvoice[]) {
  let paid = 0;
  let outstanding = 0;
  for (const invoice of invoices) {
    if (invoice.status === "PAID") paid += invoice.total;
    else if (OPEN_INVOICE.has(invoice.status)) outstanding += invoice.total;
  }
  return { paid, outstanding };
}

function validDay(value: string | null | undefined): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

/** Recruitment onboarding, then the event recognise day, then the invoice date. */
function revenueDay(
  mark: { workKind?: string; day?: string } | undefined,
  issueDate: Date,
  createdAt: Date
): string {
  const marked = validDay(mark?.day);
  if (mark?.workKind === "RECRUITMENT" && marked) return marked;
  if (mark?.workKind === "EVENT" && marked) return marked;
  if (marked) return marked;
  return validDay(hongKongDay(issueDate)) || validDay(hongKongDay(createdAt));
}

/** Non-cancelled invoices, placed by onboarding date, then recognise date, then issue date. */
async function serviceInvoices(invoiceWhere?: Record<string, unknown>): Promise<ServiceInvoice[]> {
  const invoices = await prisma.invoice.findMany({
    where: { status: { notIn: ["CANCELLED", "DRAFT"] }, ...(invoiceWhere || {}) },
    select: { id: true, total: true, status: true, issueDate: true, createdAt: true },
  });
  const marks = await loadCommissionMarks(invoices.map((invoice) => invoice.id));
  return invoices.map((invoice) => {
    const day = revenueDay(marks.get(invoice.id), invoice.issueDate, invoice.createdAt);
    return { total: Number(invoice.total) || 0, month: day.slice(0, 7), day, status: invoice.status };
  });
}

function inServiceMonth(invoice: ServiceInvoice, month: string, currentMonth: string): boolean {
  if (invoice.month) return invoice.month === month;
  return month === currentMonth;
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
export async function getMonthlyFinance(
  monthsBack: number,
  invoiceWhere?: Record<string, unknown>
): Promise<MonthlyFinance[]> {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (monthsBack - 1));

  const invoices = await prisma.invoice.findMany({
    where: { status: "PAID", paidAt: { gte: since }, ...(invoiceWhere || {}) },
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

  const [invoices, general] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { total: true, paidAt: true, expenses: { select: { amount: true } } },
    }),
    generalExpensesBetween(rangeStart, rangeEndExclusive),
  ]);

  const bucketMap = new Map(emptyBuckets.map((b) => [b.month, b]));
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const bucket = bucketMap.get(bucketKeyFor(inv.paidAt));
    if (!bucket) continue; // shouldn't happen given the query's own date range filter
    bucket.revenue += inv.total;
    bucket.expenses += inv.expenses.reduce((sum, e) => sum + e.amount, 0);
  }
  for (const expense of general) {
    const bucket = bucketMap.get(bucketKeyFor(expense.spentAt));
    if (bucket) bucket.expenses += expense.amount;
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
  const [invoices, general] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { total: true, expenses: { select: { amount: true } } },
    }),
    generalExpensesBetween(rangeStart, rangeEndExclusive),
  ]);
  const revenue = invoices.reduce((sum, i) => sum + i.total, 0);
  const expenses =
    invoices.reduce((sum, i) => sum + i.expenses.reduce((s, e) => s + e.amount, 0), 0) +
    general.reduce((sum, expense) => sum + expense.amount, 0);
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
  const [invoices, general] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "PAID", paidAt: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { total: true, expenses: { select: { category: true, amount: true } } },
    }),
    generalExpensesBetween(rangeStart, rangeEndExclusive),
  ]);
  const revenue = invoices.reduce((sum, i) => sum + i.total, 0);

  const byCategory = new Map<string, number>();
  for (const inv of invoices) {
    for (const e of inv.expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
    }
  }
  for (const expense of general) {
    byCategory.set(expense.category, (byCategory.get(expense.category) || 0) + expense.amount);
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
export async function getCurrentMonthFinance(invoiceWhere?: Record<string, unknown>): Promise<MonthlyFinance> {
  const [current] = await getMonthlyFinance(1, invoiceWhere);
  return current;
}

export type MonthDay = { day: number; revenue: number; expenses: number };

/**
 * Dashboard month figures.
 * Revenue is invoice totals whose onboarding date, then recognise date, then issue date falls in the month.
 * Cancelled and draft invoices are excluded. Expenses stay the amounts recorded that month.
 */
export async function getMonthDashboard(
  year: number,
  month: number,
  invoiceWhere?: Record<string, unknown>
): Promise<{ revenue: number; expenses: number; profit: number; invoiceCount: number; paid: number; outstanding: number; days: MonthDay[] }> {
  const start = new Date(year, month, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month + 1, 1);
  const count = new Date(year, month + 1, 0).getDate();
  const days: MonthDay[] = Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    revenue: 0,
    expenses: 0,
  }));
  const selected = `${year}-${String(month + 1).padStart(2, "0")}`;
  const current = hongKongDay(new Date()).slice(0, 7);

  const [service, expenses, general] = await Promise.all([
    serviceInvoices(invoiceWhere),
    prisma.invoiceExpense.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(invoiceWhere ? { invoice: invoiceWhere } : {}),
      },
      select: { amount: true, createdAt: true },
    }),
    generalExpensesBetween(start, end),
  ]);

  let invoiceCount = 0;
  for (const invoice of service) {
    if (!inServiceMonth(invoice, selected, current)) continue;
    invoiceCount += 1;
    const dayNumber = invoice.day ? Number(invoice.day.slice(8, 10)) : Number(hongKongDay(new Date()).slice(8, 10));
    const bucket = days[dayNumber - 1];
    if (bucket) bucket.revenue += invoice.total;
  }
  for (const expense of expenses) {
    const bucket = days[expense.createdAt.getDate() - 1];
    if (bucket) bucket.expenses += Number(expense.amount) || 0;
  }
  for (const expense of general) {
    const bucket = days[expense.spentAt.getDate() - 1];
    if (bucket) bucket.expenses += Number(expense.amount) || 0;
  }

  const revenue = days.reduce((sum, day) => sum + day.revenue, 0);
  const expenseTotal = days.reduce((sum, day) => sum + day.expenses, 0);
  const placed = service.filter((invoice) => inServiceMonth(invoice, selected, current));
  const { paid, outstanding } = settlement(placed);
  return { revenue, expenses: expenseTotal, profit: revenue - expenseTotal, invoiceCount, paid, outstanding, days };
}

/** Same revenue rules as one month, added across every month, plus every recorded expense. */
export async function getAllTimeDashboard(invoiceWhere?: Record<string, unknown>): Promise<{
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  paid: number;
  outstanding: number;
}> {
  const [service, expenseTotal, general] = await Promise.all([
    serviceInvoices(invoiceWhere),
    prisma.invoiceExpense.aggregate({
      _sum: { amount: true },
      where: invoiceWhere ? { invoice: invoiceWhere } : undefined,
    }),
    sumGeneralExpenses(),
  ]);
  const { paid, outstanding } = settlement(service);
  const revenue = service.reduce((sum, invoice) => sum + invoice.total, 0);
  const expenses = (expenseTotal._sum.amount || 0) + general;
  return {
    revenue,
    expenses,
    profit: revenue - expenses,
    invoiceCount: service.length,
    paid,
    outstanding,
  };
}

export type TrendMonth = {
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  profit: number;
};

/** One point per month from the first recorded amount through the current month. */
export async function getTrendMonths(invoiceWhere?: Record<string, unknown>): Promise<TrendMonth[]> {
  const now = new Date();
  const current = hongKongDay(now).slice(0, 7);
  const currentYear = Number(current.slice(0, 4));
  const currentMonthIndex = Number(current.slice(5, 7)) - 1;
  const [service, expenses, general] = await Promise.all([
    serviceInvoices(invoiceWhere),
    prisma.invoiceExpense.findMany({
      where: {
        createdAt: { lt: new Date(2100, 0, 1) },
        ...(invoiceWhere ? { invoice: invoiceWhere } : {}),
      },
      select: { amount: true, createdAt: true },
    }),
    generalExpensesBetween(new Date(2000, 0, 1), end),
  ]);

  const nowKey = currentYear * 12 + currentMonthIndex;
  let startKey = nowKey;
  let endKey = nowKey;
  const noteKey = (key: number) => {
    if (!Number.isFinite(key)) return;
    if (key < startKey) startKey = key;
    if (key > endKey) endKey = key;
  };
  const noteDay = (day: string) => {
    if (!/^\d{4}-\d{2}/.test(day)) return;
    noteKey(Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1));
  };
  for (const invoice of service) noteDay(invoice.month || "");
  for (const expense of expenses) noteDay(hongKongDay(expense.createdAt));
  for (const expense of general) noteDay(hongKongDay(expense.spentAt));

  const months: TrendMonth[] = [];
  for (let key = startKey; key <= endKey; key++) {
    months.push({
      year: Math.floor(key / 12),
      month: key % 12,
      revenue: 0,
      expenses: 0,
      profit: 0,
    });
  }
  const index = new Map(months.map((row, i) => [row.year * 12 + row.month, i]));
  for (const invoice of service) {
    const key = invoice.month || (current ? current : "");
    if (!invoice.month && key !== current) continue;
    const [year, month] = (invoice.month || current).split("-").map(Number);
    const at = index.get(year * 12 + (month - 1));
    if (at === undefined) continue;
    months[at].revenue += invoice.total;
  }
  for (const expense of expenses) {
    const day = hongKongDay(expense.createdAt);
    const at = index.get(Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1));
    if (at === undefined) continue;
    months[at].expenses += expense.amount;
  }
  for (const expense of general) {
    const day = hongKongDay(expense.spentAt);
    const at = index.get(Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1));
    if (at === undefined) continue;
    months[at].expenses += expense.amount;
  }
  for (const row of months) row.profit = row.revenue - row.expenses;
  return months;
}
