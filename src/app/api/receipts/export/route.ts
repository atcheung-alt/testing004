import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { dateRangeFilter } from "@/lib/dateRange";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";
import { appLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { translate } from "@/lib/i18n/translate";

/**
 * CSV export for the receipts page. Takes the same `q`/`from`/`to`/`view`
 * params as /receipts. The receipts view keeps the paid-invoice columns.
 * Expense and all-together views export the rows shown on those tabs.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const language = appLanguageFromRequest(request);
  const t = (key: string) => translate(language, key);
  const q = request.nextUrl.searchParams.get("q") || undefined;
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;
  const viewParam = request.nextUrl.searchParams.get("view");
  const view = viewParam === "expenses" || viewParam === "all" ? viewParam : "receipts";

  if (view === "receipts") {
    const receipts = await prisma.receipt.findMany({
      where: {
        issueDate: dateRangeFilter(from, to),
        invoice: q
          ? {
              OR: [
                { customerName: { contains: q, mode: "insensitive" } },
                { customerEmail: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
      },
      include: {
        invoice: { select: { number: true, customerName: true, status: true, dueDate: true, total: true } },
      },
      orderBy: { issueDate: "desc" },
    });

    const rows = receipts.map((r) => [
      r.number,
      r.invoice?.customerName || "",
      t("PAID"),
      formatDate(r.issueDate),
      formatDate(r.invoice?.dueDate || null),
      (r.invoice?.total || 0).toFixed(2),
      t("Paid"),
    ]);

    const csv = buildCsv(
      ["Number", "Customer", "Status", "Issue Date", "Due Date", "Total", "Payment Status"].map(t),
      rows
    );
    const body = language === "zh" ? `\uFEFF${csv}` : csv;
    return new NextResponse(body, { headers: csvResponseHeaders("receipts.csv") });
  }

  const range = dateRangeFilter(from, to);
  const customerFilter = q
    ? {
        OR: [
          { customerName: { contains: q, mode: "insensitive" as const } },
          { customerEmail: { contains: q, mode: "insensitive" as const } },
          { number: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const receipts =
    view === "all"
      ? await prisma.receipt.findMany({
          where: { issueDate: range, invoice: customerFilter },
          include: { invoice: { select: { customerName: true, total: true } } },
          orderBy: { issueDate: "desc" },
        })
      : [];

  const expenses = await prisma.invoiceExpense.findMany({
    where: { createdAt: range, invoice: customerFilter },
    include: { invoice: { select: { number: true, customerName: true } } },
    orderBy: { createdAt: "desc" },
  });

  const combined = [
    ...receipts.map((receipt) => ({
      when: receipt.issueDate,
      cells: [
        t("Receipt"),
        receipt.number,
        receipt.invoice?.customerName || "",
        "",
        formatDate(receipt.issueDate),
        (receipt.invoice?.total || 0).toFixed(2),
      ],
    })),
    ...expenses.map((expense) => ({
      when: expense.createdAt,
      cells: [
        t("Expense"),
        expense.invoice.number,
        expense.invoice.customerName,
        expense.category === "Others" ? expense.label || t("Others") : t(expense.category),
        formatDate(expense.createdAt),
        expense.amount.toFixed(2),
      ],
    })),
  ].sort((a, b) => b.when.getTime() - a.when.getTime());

  const csv = buildCsv(
    ["Record type", "Number", "Customer", "Category", "Date", "Amount"].map(t),
    combined.map((row) => row.cells)
  );
  const body = language === "zh" ? `\uFEFF${csv}` : csv;
  const filename = view === "expenses" ? "expenses.csv" : "receipts-and-expenses.csv";
  return new NextResponse(body, { headers: csvResponseHeaders(filename) });
}
