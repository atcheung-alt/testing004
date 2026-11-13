import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering";
import { computeDueDate } from "@/lib/document-helpers";
import { logActivity } from "@/lib/activity";

/**
 * Create the invoice for a quotation and lock the quotation as CONVERTED.
 * Idempotent — if the quotation already has an invoice, that invoice is
 * returned as-is rather than creating a second one (a quotation can only
 * ever have one invoice; `Invoice.quotationId` is unique).
 */
export async function convertQuotationToInvoice(
  quotationId: string,
  dueDateOverride?: Date
) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: { orderBy: { sortOrder: "asc" } }, invoice: true },
  });

  if (!quotation) {
    throw new Error("Quotation not found.");
  }
  if (quotation.invoice) {
    return quotation.invoice;
  }

  const number = await nextDocumentNumber("invoice");
  // Set explicitly (rather than relying on the schema's `@default(now())`)
  // so issueDate and the due-date calculation below are based on the exact
  // same instant. Default the invoice due date to the quotation's payment
  // window when the caller doesn't specify one, keeping the payment term
  // consistent.
  const issueDate = new Date();
  const dueDate = dueDateOverride ?? computeDueDate(issueDate, quotation.paymentDueDays || 30);

  const created = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        number,
        title: quotation.title,
        customerName: quotation.customerName,
        customerContact: quotation.customerContact,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone,
        customerAddress: quotation.customerAddress,
        quotationId: quotation.id,
        issueDate,
        dueDate,
        status: "UNPAID",
        notes: quotation.notes,
        terms: quotation.terms,
        reminder: quotation.reminder,
        language: quotation.language,
        paymentDueDays: quotation.paymentDueDays,
        taxRate: quotation.taxRate,
        discount: quotation.discount,
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        total: quotation.total,
        createdByEmail: quotation.createdByEmail,
        items: {
          create: quotation.items.map((item) => ({
            name: item.name,
            description: item.description,
            imageData: item.imageData,
            unit: item.unit,
            quantity: item.quantity,
            multipliers: item.multipliers,
            unitPrice: item.unitPrice,
            amount: item.amount,
            duration: item.duration,
            fees: item.fees,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    });

    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "CONVERTED" },
    });

    return created;
  });

  await logConversion(quotation.number, created.id, created.number, quotation.id);
  return created;
}

/**
 * Fire the CREATED (on the invoice) and INVOICE_GENERATED (on the quotation)
 * timeline events after a real conversion. Kept separate from the
 * transaction above so a logging hiccup never rolls back the actual
 * conversion, and skipped entirely on the idempotent early-return path
 * (quotation already had an invoice — nothing new happened).
 */
async function logConversion(quotationNumber: string, invoiceId: string, invoiceNumber: string, quotationId: string) {
  await logActivity({
    documentType: "invoice",
    documentId: invoiceId,
    type: "CREATED",
    actor: "SYSTEM",
    description: `Created from quotation ${quotationNumber}`,
  });
  await logActivity({
    documentType: "quotation",
    documentId: quotationId,
    type: "INVOICE_GENERATED",
    actor: "SYSTEM",
    description: `Invoice ${invoiceNumber} generated`,
  });
}
