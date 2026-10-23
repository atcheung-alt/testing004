import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceCanModify } from "@/lib/documentAccess";
import { commissionSplitError, saveInvoiceCommissionSplit } from "@/lib/invoiceCommission";

export const dynamic = "force-dynamic";

/** Save the colleague split for an invoice. The rows stay on the linked
 *  quotation record, which is the existing place shares are stored. A
 *  standalone invoice gets a hidden quotation created only to hold that split. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceCanModify(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      number: true,
      title: true,
      customerName: true,
      customerContact: true,
      customerEmail: true,
      customerPhone: true,
      customerAddress: true,
      subtotal: true,
      taxRate: true,
      taxAmount: true,
      discount: true,
      total: true,
      quotationId: true,
      quotation: { select: { number: true, preparedBy: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const problem = commissionSplitError(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  await saveInvoiceCommissionSplit(invoice, body);
  return NextResponse.json({ ok: true });
}
