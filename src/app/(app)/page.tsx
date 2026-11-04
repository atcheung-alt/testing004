import Link from "next/link";
import { FileText, ReceiptText, Wallet, AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus, isOverdueInvoice } from "@/lib/invoiceStatus";
import { getMonthDashboard, getTrendMonths } from "@/lib/finance";
import StatCard from "@/components/StatCard";
import AnimatedAmount from "@/components/AnimatedAmount";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import PageBar from "@/components/PageBar";
import DashboardMonthSelect from "@/components/DashboardMonthSelect";
import DashboardTrend from "@/components/DashboardTrend";
import { getT } from "@/lib/i18n/server";
import { currentInvoiceFilter, currentQuotationFilter } from "@/lib/documentAccess";
import { sumGeneralExpenses } from "@/lib/generalExpense";
import { loadClientSources } from "@/lib/clientSource";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function chosenMonth(value: string | undefined) {
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() };
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return current;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7)) - 1;
  if (month < 0 || month > 11) return current;
  if (year < now.getFullYear() - 5 || year > now.getFullYear()) return current;
  return { year, month };
}

export default async function DashboardPage({ searchParams }: { searchParams: { month?: string } }) {
  const t = getT();
  const chosen = chosenMonth(searchParams.month);
  const now = new Date();
  const viewingCurrent = chosen.year === now.getFullYear() && chosen.month === now.getMonth();
  const [quotationFilter, invoiceFilter] = await Promise.all([currentQuotationFilter(), currentInvoiceFilter()]);
  const quotationWhere = quotationFilter || undefined;
  const invoiceWhere = invoiceFilter || undefined;
  const expenseWhere = invoiceFilter ? { invoice: invoiceFilter } : undefined;
  const [quotations, invoices, recentQuotations, recentInvoices, monthFinance, trendMonths, expenseTotal, recentExpenses, generalExpenseSum] =
    await Promise.all([
      prisma.quotation.findMany({ where: quotationWhere, select: { status: true, total: true } }),
      prisma.invoice.findMany({ where: invoiceWhere, select: { id: true, status: true, total: true, dueDate: true } }),
      prisma.quotation.findMany({ where: quotationWhere, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.invoice.findMany({ where: invoiceWhere, orderBy: { createdAt: "desc" }, take: 6 }),
      getMonthDashboard(chosen.year, chosen.month, invoiceFilter || undefined),
      getTrendMonths(invoiceFilter || undefined),
      prisma.invoiceExpense.aggregate({ _sum: { amount: true }, where: expenseWhere }),
      prisma.invoiceExpense.findMany({
        where: expenseWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { invoice: { select: { id: true, number: true, customerName: true } } },
      }),
      sumGeneralExpenses(),
    ]);
  const clientSources = await loadClientSources(invoices.map((invoice) => invoice.id));
  const sourceTotals = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.status === "CANCELLED") continue;
    const name = clientSources.get(invoice.id);
    if (!name) continue;
    sourceTotals.set(name, (sourceTotals.get(name) || 0) + invoice.total);
  }

  const invoiced = invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.total, 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + i.total, 0);
  const expenseSum = (expenseTotal._sum.amount || 0) + generalExpenseSum;
  const monthProfit = monthFinance.profit;

  const outstanding = invoices
    .filter(
      (i) =>
        i.status === "UNPAID" || i.status === "OVERDUE" || i.status === "PENDING_VERIFICATION"
    )
    .reduce((sum, i) => sum + i.total, 0);
  const quotedValue = quotations
    .filter((q) => q.status === "SENT" || q.status === "DRAFT")
    .reduce((sum, q) => sum + q.total, 0);

  const overdueInvoices = invoices.filter(isOverdueInvoice);
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.total, 0);
  const collected = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0;
  const monthMax = Math.max(monthFinance.revenue, monthFinance.expenses, Math.abs(monthProfit), 1);
  const monthRows = [
    { label: t("Revenue"), amount: monthFinance.revenue, color: "bg-brand-500" },
    { label: t("Expenses"), amount: monthFinance.expenses, color: "bg-danger-500" },
    {
      label: t("Net Profit"),
      amount: monthProfit,
      color: monthProfit < 0 ? "bg-danger-500" : "bg-accent-500",
    },
  ];
  const monthName = `${t(MONTH_NAMES[chosen.month])} ${chosen.year}`;

  return (
    <div className="flex flex-col gap-4">
      <PageBar title={t("Dashboard")} note={t("Invoices, payments, expenses, and what is still outstanding.")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={t("Invoices")}
          value={formatCurrency(invoiced)}
          amount={invoiced}
          detail={t("{count} Invoices", { count: invoices.length })}
          icon={ReceiptText}
        />
        <StatCard
          label={t("Paid")}
          value={formatCurrency(paid)}
          amount={paid}
          icon={TrendingUp}
          accent="accent"
        />
        <StatCard
          label={t("Expenses")}
          value={formatCurrency(expenseSum)}
          amount={expenseSum}
          detail={t("Logged against invoices")}
          icon={Wallet}
          accent="danger"
        />
        <StatCard
          label={t("Outstanding")}
          value={formatCurrency(outstanding)}
          amount={outstanding}
          icon={AlertTriangle}
          accent="accent"
        />
      </div>

      <div className="card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("Collected")}</p>
          <p className="font-mono text-sm text-ink">{collected}%</p>
        </div>
        <div className="relative h-1.5 rounded-full bg-paper overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand-500 animate-fill-bar"
            style={{ ["--bar" as string]: `${collected}%` }}
          />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold">{viewingCurrent ? t("This Month") : monthName}</h2>
          <DashboardMonthSelect year={chosen.year} month={chosen.month} />
        </div>
        <div className="flex flex-col gap-4">
          {monthRows.map((row) => {
            const width = row.amount === 0 ? "0%" : `${Math.max(8, Math.round((Math.abs(row.amount) / monthMax) * 100))}%`;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{row.label}</p>
                  <AnimatedAmount value={row.amount} className="font-mono text-sm text-ink" />
                </div>
                <div className="relative h-1.5 rounded-full bg-paper overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full animate-fill-bar ${row.color}`}
                    style={{ ["--bar" as string]: width }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-faint mt-4">
          {viewingCurrent
            ? t("Revenue is invoices paid this calendar month. The expenses bar is the total recorded on the Expenses page this month.")
            : t("Revenue is invoices paid in {month}. The expenses bar is the total recorded on the Expenses page in {month}.", { month: monthName })}
        </p>
      </div>

      {sourceTotals.size > 0 ? (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-4">{t("Client source")}</h2>
          <div className="flex flex-col gap-3">
            {Array.from(sourceTotals.entries()).map(([name, amount]) => (
              <div key={name} className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">{name}</p>
                <p className="font-mono text-sm text-ink">{formatCurrency(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <DashboardTrend months={trendMonths} year={chosen.year} month={chosen.month} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">{t("Recent Expenses")}</h2>
          <Link href="/expenses" className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1">
            {t("View All")} <ArrowRight size={14} />
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={t("No Expenses Yet")}
            description={t("Record a cost against an invoice and upload the receipt.")}
            actionHref="/expenses"
            actionLabel={t("Record an Expense")}
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="hidden sm:grid grid-cols-[8rem_1fr_8rem_7rem] gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint border-b border-line">
              <span>{t("Invoice")}</span>
              <span>{t("Customer")}</span>
              <span>{t("Category")}</span>
              <span className="text-right">{t("Amount")}</span>
            </div>
            <div className="divide-y divide-line">
              {recentExpenses.map((expense) => (
                <Link
                  key={expense.id}
                  href={`/invoices/${expense.invoice.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[8rem_1fr_8rem_7rem] gap-1 sm:gap-3 px-4 py-3 hover:bg-paper"
                >
                  <span className="font-mono text-sm font-medium">{expense.invoice.number}</span>
                  <span className="text-sm text-ink-muted truncate">{expense.invoice.customerName}</span>
                  <span className="text-sm">{expense.category === "Others" ? expense.label || t("Others") : t(expense.category)}</span>
                  <span className="font-mono text-sm sm:text-right">{formatCurrency(expense.amount)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">{t("Recent Quotations")}</h2>
            <Link
              href="/quotations"
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              {t("View All")} <ArrowRight size={14} />
            </Link>
          </div>
          {recentQuotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("No Quotations Yet")}
              description={t("Create your first quotation to start quoting customers for work.")}
              actionHref="/quotations/new"
              actionLabel={t("New Quotation")}
            />
          ) : (
            <div className="card divide-y divide-line">
              {recentQuotations.map((q) => (
                <Link
                  key={q.id}
                  href={`/quotations/${q.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm font-medium text-ink">{q.number}</p>
                    <p className="text-xs text-ink-muted">
                      {q.customerName} · {formatDate(q.issueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{formatCurrency(q.total)}</span>
                    <StatusBadge status={q.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">{t("Recent Invoices")}</h2>
            <Link
              href="/invoices"
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              {t("View All")} <ArrowRight size={14} />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={t("No Invoices Yet")}
              description={t("Convert an accepted quotation, or create an invoice directly.")}
              actionHref="/invoices/new"
              actionLabel={t("New Invoice")}
            />
          ) : (
            <div className="card divide-y divide-line">
              {recentInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-paper transition-colors"
                >
                  <div>
                    <p className="font-mono text-sm font-medium text-ink">{inv.number}</p>
                    <p className="text-xs text-ink-muted">
                      {inv.customerName} · {formatDate(inv.issueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{formatCurrency(inv.total)}</span>
                    <StatusBadge status={getInvoiceDisplayStatus(inv)} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {(quotedValue > 0 || overdueCount > 0) && (
        <div className="flex flex-col gap-1">
          {overdueCount > 0 && (
            <p className="text-xs text-danger-500">
              {overdueCount === 1
                ? t("{count} invoice overdue, totalling {amount}.", {
                    count: overdueCount,
                    amount: formatCurrency(overdueAmount),
                  })
                : t("{count} invoices overdue, totalling {amount}.", {
                    count: overdueCount,
                    amount: formatCurrency(overdueAmount),
                  })}
            </p>
          )}
          {quotedValue > 0 && (
            <p className="text-xs text-ink-muted">
              {t("{amount} in open quotations awaiting a response.", {
                amount: formatCurrency(quotedValue),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
