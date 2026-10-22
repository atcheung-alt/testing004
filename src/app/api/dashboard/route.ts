import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOverdueInvoice } from "@/lib/invoiceStatus";
import { SHARE_HOLDER_PREFIX } from "@/lib/quotationShares";

export const dynamic = "force-dynamic";

export async function GET() {
  const [presetItemCount, quotations, invoices, recentQuotations, recentInvoices] =
    await Promise.all([
      prisma.presetItem.count(),
      prisma.quotation.findMany({
        where: { NOT: { number: { startsWith: SHARE_HOLDER_PREFIX } } },
        select: { status: true, total: true },
      }),
      prisma.invoice.findMany({ select: { status: true, total: true, dueDate: true } }),
      prisma.quotation.findMany({
        where: { NOT: { number: { startsWith: SHARE_HOLDER_PREFIX } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

  const outstanding = invoices
    .filter(
      (i) =>
        i.status === "UNPAID" || i.status === "OVERDUE" || i.status === "PENDING_VERIFICATION"
    )
    .reduce((sum, i) => sum + i.total, 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + i.total, 0);
  const quotedValue = quotations
    .filter((q) => q.status === "SENT" || q.status === "DRAFT")
    .reduce((sum, q) => sum + q.total, 0);

  const overdueInvoices = invoices.filter(isOverdueInvoice);
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.total, 0);

  return NextResponse.json({
    presetItemCount,
    quotationCount: quotations.length,
    invoiceCount: invoices.length,
    outstanding,
    paid,
    quotedValue,
    overdueCount,
    overdueAmount,
    recentQuotations,
    recentInvoices,
  });
}
