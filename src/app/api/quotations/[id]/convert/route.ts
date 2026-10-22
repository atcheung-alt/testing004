import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { convertQuotationToInvoice } from "@/lib/quotationToInvoice";
import { withParsedItems } from "@/lib/document-helpers";
import { quotationCanModify } from "@/lib/documentAccess";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationCanModify(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));

  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    select: { id: true, invoice: { select: { id: true } } },
  });

  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  if (quotation.invoice) {
    return NextResponse.json(
      { error: "This quotation has already been converted to an invoice." },
      { status: 409 }
    );
  }

  const invoice = await convertQuotationToInvoice(
    params.id,
    body.dueDate ? new Date(body.dueDate) : undefined
  );

  return NextResponse.json(
    "items" in invoice ? withParsedItems(invoice as any) : invoice,
    { status: 201 }
  );
}
