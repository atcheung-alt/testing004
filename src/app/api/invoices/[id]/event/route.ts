import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEventForInvoice, createEventForInvoice } from "@/lib/events";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * "Mark on Calendar" — create this invoice's one-and-only Event row (see the
 * Event model in schema.prisma) once staff has set both an event start and
 * end date on the invoice and confirmed a name for it. This is the only way
 * an Event ever gets created; there's no "unmark"/edit action yet.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json();
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Please enter an event name." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      customerName: true,
      customerContact: true,
      eventStartDate: true,
      eventStartTime: true,
      eventEndDate: true,
      eventEndTime: true,
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  if (!invoice.eventStartDate || !invoice.eventEndDate) {
    return NextResponse.json(
      { error: "Set both an event start and end date on this invoice first." },
      { status: 400 }
    );
  }

  const existing = await getEventForInvoice(invoice.id);
  if (existing) {
    return NextResponse.json({ error: "This invoice is already on the calendar." }, { status: 409 });
  }

  const event = await createEventForInvoice({
    invoiceId: invoice.id,
    name,
    startDate: invoice.eventStartDate,
    startTime: invoice.eventStartTime,
    endDate: invoice.eventEndDate,
    endTime: invoice.eventEndTime,
    contactPerson: invoice.customerContact,
    companyName: invoice.customerName,
  });

  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "EDITED",
    description: `Marked on calendar as "${name}"`,
  });

  return NextResponse.json({
    ...event,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  });
}
