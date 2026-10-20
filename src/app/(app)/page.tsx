import Link from "next/link";
import { FileText, ReceiptText, Wallet, AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getInvoiceDisplayStatus, isOverdueInvoice } from "@/lib/invoiceStatus";
import { getCurrentMonthFinance } from "@/lib/finance";
import StatCard from "@/components/StatCard";
import AnimatedAmount from "@/components/AnimatedAmount";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = getT();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const [quotations, invoices, recentQuotations, recentInvoices, thisMonth, expenseTotal, monthExpenses, recentExpenses] =
    await Promise.all([
      prisma.quotation.findMany({ select: { status: true, total: true } }),
      prisma.invoice.findMany({ select: { status: true, total: true, dueDate: true } }),
      prisma.quotation.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      getCurrentMonthFinance(),
      prisma.invoiceExpense.aggregate({ _sum: { amount: true } }),
      prisma.invoiceExpense.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: monthStart, lt: nextMonth } },
      }),
      prisma.invoiceExpense.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { invoice: { select: { id: true, number: true, customerName: true } } },
      }),
    ]);

  const invoiced = invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((sum, i) => sum + i.total, 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + i.total, 0);
  const expenseSum = expenseTotal._sum.amount || 0;
  const monthExpenseSum = monthExpenses._sum.amount || 0;
  const monthProfit = thisMonth.revenue - monthExpenseSum;

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
  const monthMax = Math.max(thisMonth.revenue, monthExpenseSum, Math.abs(monthProfit), 1);
  const monthRows = [
    { label: t("Revenue"), amount: thisMonth.revenue, color: "bg-brand-500" },
    { label: t("Expenses"), amount: monthExpenseSum, color: "bg-danger-500" },
    {
      label: t("Net profit"),
      amount: monthProfit,
      color: monthProfit < 0 ? "bg-danger-500" : "bg-accent-500",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-2xl font-semibold text-ink">{t("Dashboard")}</h1>
        </div>
        <p className="lead">
          {t("Invoices, payments, expenses, and what is still outstanding.")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label={t("Invoices")}
          value={formatCurrency(invoiced)}
          amount={invoiced}
          detail={t("{count} invoices", { count: invoices.length })}
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
        <h2 className="font-display text-lg font-semibold mb-4">{t("This month")}</h2>
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
          {t("Revenue is invoices paid this calendar month. The expenses bar is the total recorded on the Expenses page this month.")}
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">{t("Recent expenses")}</h2>
          <Link href="/expenses" className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1">
            {t("View all")} <ArrowRight size={14} />
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={t("No expenses yet")}
            description={t("Record a cost against an invoice and upload the receipt.")}
            actionHref="/expenses"
            actionLabel={t("Record an expense")}
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
            <h2 className="font-display text-lg font-semibold">{t("Recent quotations")}</h2>
            <Link
              href="/quotations"
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              {t("View all")} <ArrowRight size={14} />
            </Link>
          </div>
          {recentQuotations.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("No quotations yet")}
              description={t("Create your first quotation to start quoting customers for work.")}
              actionHref="/quotations/new"
              actionLabel={t("New quotation")}
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
            <h2 className="font-display text-lg font-semibold">{t("Recent invoices")}</h2>
            <Link
              href="/invoices"
              className="text-sm text-brand-500 hover:text-brand-600 flex items-center gap-1"
            >
              {t("View all")} <ArrowRight size={14} />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={t("No invoices yet")}
              description={t("Convert an accepted quotation, or create an invoice directly.")}
              actionHref="/invoices/new"
              actionLabel={t("New invoice")}
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
