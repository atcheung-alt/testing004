import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { dateRangeFilter } from "@/lib/dateRange";
import { buildCsv, csvResponseHeaders } from "@/lib/csv";
import { appLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { translate } from "@/lib/i18n/translate";
import { andFilters, currentQuotationFilter } from "@/lib/documentAccess";

/**
 * CSV export for the quotations list — takes the exact same `q`/`status`/
 * `from`/`to` query params as the /quotations page so "Export CSV" always
 * reflects whatever search and filters are currently active.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const language = appLanguageFromRequest(request);
  const t = (key: string) => translate(language, key);
  const q = request.nextUrl.searchParams.get("q") || undefined;
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;

  const quotations = await prisma.quotation.findMany({
    where: andFilters(
      {
        status: status || undefined,
        issueDate: dateRangeFilter(from, to),
        OR: q
          ? [
              { customerName: { contains: q, mode: "insensitive" } },
              { customerEmail: { contains: q, mode: "insensitive" } },
            ]
          : undefined,
      },
      await currentQuotationFilter()
    ),
    include: { invoice: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = quotations.map((q) => [
    q.number,
    q.customerName,
    t(q.status),
    formatDate(q.issueDate),
    formatDate(q.expiryDate), // quotations don't have a "due date" — expiry is the closest equivalent
    q.total.toFixed(2),
    t(q.invoice ? (q.invoice.status === "PAID" ? "Paid" : "Unpaid") : "N/A"), // not billed yet
  ]);

  const csv = buildCsv(
    ["Number", "Customer", "Status", "Issue Date", "Expiry Date", "Total", "Payment Status"].map(t),
    rows
  );
  const body = language === "zh" ? `\uFEFF${csv}` : csv;

  return new NextResponse(body, { headers: csvResponseHeaders("quotations.csv") });
}
