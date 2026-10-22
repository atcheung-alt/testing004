import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invoiceCanModify } from "@/lib/documentAccess";
import { logActivity } from "@/lib/activity";
import { bindShareColleagueNames } from "@/lib/quotationAuthor";
import { SHARE_HOLDER_PREFIX, quotationShareFieldsFrom } from "@/lib/quotationShares";

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
    },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sharing = quotationShareFieldsFrom(body);
  if (sharing.error) return NextResponse.json({ error: sharing.error }, { status: 400 });
  const boundShares = await bindShareColleagueNames(sharing.shares);

  const quotationId = invoice.quotationId || (await ensureShareHolder(invoice));
  await prisma.$transaction(async (tx) => {
    await tx.quotationShare.deleteMany({ where: { quotationId } });
    await tx.quotation.update({
      where: { id: quotationId },
      data: {
        preparedBy: sharing.preparedBy,
        shareMode: sharing.shareMode,
        shares: { create: boundShares },
      },
    });
  });
  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "EDITED",
    description: "Colleague split updated",
  });
  return NextResponse.json({ ok: true });
}

async function ensureShareHolder(invoice: {
  id: string;
  number: string;
  title: string;
  customerName: string;
  customerContact: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
}) {
  const number = `${SHARE_HOLDER_PREFIX}${invoice.number}`;
  const existing = await prisma.quotation.findUnique({ where: { number }, select: { id: true } });
  const quotation =
    existing ||
    (await prisma.quotation.create({
      data: {
        number,
        title: invoice.title,
        customerName: invoice.customerName,
        customerContact: invoice.customerContact,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        customerAddress: invoice.customerAddress,
        status: "CONVERTED",
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discount: invoice.discount,
        total: invoice.total,
      },
      select: { id: true },
    }));
  await prisma.invoice.update({ where: { id: invoice.id }, data: { quotationId: quotation.id } });
  return quotation.id;
}
