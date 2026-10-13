import { BarChart3, TrendingUp, TrendingDown, Minus, Download, FileText, Wallet, Receipt, PieChart } from "lucide-react";
import {
  getFinanceByPeriod,
  getPeriodTotals,
  previousReferenceDate,
  percentChange,
  getExpenseBreakdown,
  getAccountsReceivable,
} from "@/lib/finance";
import type { FinanceGranularity } from "@/lib/finance";
import { formatCurrency, formatDate } from "@/lib/calculations";
import MonthlyFinanceChart from "@/components/MonthlyFinanceChart";
import ExpenseBreakdownChart from "@/components/ExpenseBreakdownChart";
import AnalysisFilters from "@/components/AnalysisFilters";
import BudgetEditor from "@/components/BudgetEditor";
import { getAppLanguage, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const VALID_GRANULARITIES: FinanceGranularity[] = ["week", "month", "year"];

function parseGranularity(value: string | undefined): FinanceGranularity {
  return VALID_GRANULARITIES.includes(value as FinanceGranularity)
    ? (value as FinanceGranularity)
    : "month";
}

function parseRefDate(value: string | undefined): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function DeltaBadge({ pct, invertColor = false }: { pct: number | null; invertColor?: boolean }) {
  const t = getT();
  if (pct === null) {
    return <span className="text-xs text-ink-faint">{t("n/a vs previous")}</span>;
  }
  const isUp = pct > 0.05;
  const isDown = pct < -0.05;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  // For revenue/profit, an increase is favorable (green). For expenses,
  // invertColor=true flips that — a decrease is what's favorable there —
  // but the displayed number and arrow direction always reflect the true,
  // unmodified change either way.
  const isFavorable = invertColor ? !isUp : isUp;
  const color = isUp || isDown ? (isFavorable ? "text-emerald-600" : "text-danger-500") : "text-ink-faint";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon size={12} />
      {t("{change}% vs previous", {
        change: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}`,
      })}
    </span>
  );
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: { granularity?: string; ref?: string };
}) {
  const t = getT();
  const locale = getAppLanguage() === "zh" ? "zh-HK" : "en-US";
  const granularity = parseGranularity(searchParams.granularity);
  const refDate = parseRefDate(searchParams.ref);
  const previousRef = previousReferenceDate(granularity, refDate);

  const [{ buckets, rangeLabel }, previousTotals, expenseBreakdown, ar] = await Promise.all([
    getFinanceByPeriod(granularity, refDate, locale),
    getPeriodTotals(granularity, previousRef, locale),
    getExpenseBreakdown(granularity, refDate),
    getAccountsReceivable(),
  ]);

  const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
  const totalExpenses = buckets.reduce((sum, b) => sum + b.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  const revenueDelta = percentChange(previousTotals.revenue, totalRevenue);
  const expensesDelta = percentChange(previousTotals.expenses, totalExpenses);
  const profitDelta = percentChange(previousTotals.profit, totalProfit);

  const exportParams = new URLSearchParams({
    granularity,
    ref: refDate.toISOString().slice(0, 10),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink mb-1">{t("Analysis")}</h1>
          <p className="text-sm text-ink-muted">
            {t("Revenue, expenses, and net profit — pick a week, month, or year to view.")}
          </p>
        </div>
        <a href={`/api/analysis/export?${exportParams.toString()}`} className="btn-secondary shrink-0">
          <Download size={15} /> {t("Export CSV")}
        </a>
      </div>

      <AnalysisFilters granularity={granularity} refDate={refDate} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {granularity === "week"
              ? t("Revenue this week")
              : granularity === "year"
              ? t("Revenue this year")
              : t("Revenue this month")}
          </p>
          <p className="font-mono text-2xl font-semibold text-ink">{formatCurrency(totalRevenue)}</p>
          <div className="mt-1">
            <DeltaBadge pct={revenueDelta} />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {granularity === "week"
              ? t("Expenses this week")
              : granularity === "year"
              ? t("Expenses this year")
              : t("Expenses this month")}
          </p>
          <p className="font-mono text-2xl font-semibold text-ink">{formatCurrency(totalExpenses)}</p>
          <div className="mt-1">
            <DeltaBadge pct={expensesDelta} invertColor />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {granularity === "week"
              ? t("Net profit this week")
              : granularity === "year"
              ? t("Net profit this year")
              : t("Net profit this month")}
          </p>
          <p
            className={`font-mono text-2xl font-semibold ${totalProfit < 0 ? "text-danger-500" : "text-ink"}`}
          >
            {formatCurrency(totalProfit)}
          </p>
          <div className="mt-1">
            <DeltaBadge pct={profitDelta} />
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-faint -mt-3">
        {granularity === "week"
          ? t(
              "Horizontal analysis: comparing against the previous week ({range}). For expenses, a green arrow means costs went down — favorable, unlike revenue/profit.",
              { range: previousTotals.rangeLabel }
            )
          : granularity === "year"
          ? t(
              "Horizontal analysis: comparing against the previous year ({range}). For expenses, a green arrow means costs went down — favorable, unlike revenue/profit.",
              { range: previousTotals.rangeLabel }
            )
          : t(
              "Horizontal analysis: comparing against the previous month ({range}). For expenses, a green arrow means costs went down — favorable, unlike revenue/profit.",
              { range: previousTotals.rangeLabel }
            )}
      </p>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={17} className="text-brand-600" />
          <h2 className="font-display text-lg font-semibold">{rangeLabel}</h2>
        </div>
        <MonthlyFinanceChart data={buckets} />
      </div>

      {granularity === "month" && (
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold mb-1">{t("Budget & variance")}</h2>
          <p className="text-sm text-ink-muted mb-4">
            {t("Set a monthly target, then see how actuals compared once the month plays out.")}
          </p>
          <BudgetEditor
            year={refDate.getFullYear()}
            month={refDate.getMonth() + 1}
            actualRevenue={totalRevenue}
            actualExpenses={totalExpenses}
          />
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={17} className="text-brand-600" />
          <h2 className="font-display text-lg font-semibold">{t("Income statement")}</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">{rangeLabel}</p>
        <div className="flex flex-col divide-y divide-line text-sm">
          <div className="flex items-center justify-between py-2">
            <span className="text-ink">{t("Revenue")}</span>
            <span className="font-mono font-medium">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="py-2">
            <p className="text-ink-muted mb-2">{t("Expenses by category (vertical analysis — % of revenue)")}</p>
            {expenseBreakdown.categories.length === 0 ? (
              <p className="text-xs text-ink-faint">{t("No expenses logged for this period.")}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {expenseBreakdown.categories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between pl-3">
                    <span className="text-ink-muted">{t(c.category)}</span>
                    <span className="font-mono">
                      {formatCurrency(c.amount)}
                      {c.pctOfRevenue !== null && (
                        <span className="text-ink-faint"> ({c.pctOfRevenue.toFixed(1)}%)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-ink">{t("Total expenses")}</span>
            <span className="font-mono font-medium">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-semibold text-ink">{t("Net profit")}</span>
            <span
              className={`font-mono font-semibold ${totalProfit < 0 ? "text-danger-500" : "text-ink"}`}
            >
              {formatCurrency(totalProfit)}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Wallet size={17} className="text-brand-600" />
          <h2 className="font-display text-lg font-semibold">{t("Cash flow (operating activities)")}</h2>
        </div>
        <p className="text-xs text-ink-faint mb-4">
          {t(
            "This app only tracks quotation/invoice/expense cash flow — not a full cash flow statement, which would also need investing and financing activity (loans, equipment, owner contributions) this app doesn't record."
          )}
        </p>
        <div className="flex flex-col divide-y divide-line text-sm">
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{t("Cash in (invoices paid)")}</span>
            <span className="font-mono">{formatCurrency(totalRevenue)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-ink-muted">{t("Cash out (expenses logged)")}</span>
            <span className="font-mono">({formatCurrency(totalExpenses)})</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="font-semibold text-ink">{t("Net change in cash")}</span>
            <span
              className={`font-mono font-semibold ${totalProfit < 0 ? "text-danger-500" : "text-ink"}`}
            >
              {formatCurrency(totalProfit)}
            </span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Receipt size={17} className="text-brand-600" />
          <h2 className="font-display text-lg font-semibold">{t("Accounts receivable")}</h2>
        </div>
        <p className="text-xs text-ink-faint mb-4">
          {t(
            "What clients currently owe, as of today — not scoped to the period above. Not a full balance sheet (this app doesn't track cash balances, assets, liabilities, or equity), but this part is real and derivable."
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {ar.buckets.map((b) => (
            <div key={b.label} className="rounded-xl border border-line p-3">
              <p className="text-xs text-ink-muted mb-1">{t(b.label)}</p>
              <p className="font-mono text-sm font-semibold">{formatCurrency(b.amount)}</p>
              <p className="text-xs text-ink-faint">
                {b.count === 1
                  ? t("{count} invoice", { count: b.count })
                  : t("{count} invoices", { count: b.count })}
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm mb-3 pb-3 border-b border-line">
          <span className="font-semibold text-ink">{t("Total outstanding")}</span>
          <span className="font-mono font-semibold">{formatCurrency(ar.total)}</span>
        </div>
        {ar.invoices.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("Nothing outstanding right now.")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {ar.invoices.slice(0, 10).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 text-sm gap-3">
                <div className="min-w-0">
                  <p className="text-ink truncate">
                    {inv.number} — {inv.customerName}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {t("Due {date}", { date: formatDate(inv.dueDate) })}
                    {inv.daysOutstanding > 0 &&
                      ` · ${t("{days}d overdue", { days: inv.daysOutstanding })}`}
                  </p>
                </div>
                <span className="font-mono shrink-0">{formatCurrency(inv.total)}</span>
              </div>
            ))}
            {ar.invoices.length > 10 && (
              <p className="text-xs text-ink-faint pt-2">
                {t("+{count} more — see the Invoices page for the full list.", {
                  count: ar.invoices.length - 10,
                })}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <PieChart size={17} className="text-brand-600" />
          <h2 className="font-display text-lg font-semibold">{t("Expense breakdown")}</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          {granularity === "week"
            ? t("Which expense category takes the biggest share this week — {range}.", { range: rangeLabel })
            : granularity === "year"
            ? t("Which expense category takes the biggest share this year — {range}.", { range: rangeLabel })
            : t("Which expense category takes the biggest share this month — {range}.", { range: rangeLabel })}
        </p>
        <ExpenseBreakdownChart categories={expenseBreakdown.categories} />
      </div>
    </div>
  );
}
