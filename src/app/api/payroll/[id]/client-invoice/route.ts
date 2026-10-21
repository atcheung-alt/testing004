import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { computeTotals, round2 } from "@/lib/calculations";
import { computeDueDate, documentDefaultsFrom, itemCreateFrom } from "@/lib/document-helpers";
import { nextDocumentNumber } from "@/lib/numbering";
import { logActivity } from "@/lib/activity";
import { periodLabel } from "@/lib/payroll";
import { findClientBill, readClientTerms, rememberClientBill, serviceFeeFor, termFor } from "@/lib/clientService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  if (!companyId) {
    return NextResponse.json({ error: "Choose a client company." }, { status: 400 });
  }

  const [run, company, terms] = await Promise.all([
    prisma.payrollRun.findUnique({
      where: { id: params.id },
      include: {
        entries: {
          include: { employee: { select: { companyId: true } } },
          orderBy: { employeeName: "asc" },
        },
      },
    }),
    prisma.employerCompany.findUnique({ where: { id: companyId } }),
    readClientTerms(),
  ]);
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  if (!company) return NextResponse.json({ error: "That company doesn't exist." }, { status: 404 });

  const entries = run.entries.filter((entry) => entry.employee.companyId === company.id);
  if (entries.length === 0) {
    return NextResponse.json({ error: "This client has no one on this payroll run." }, { status: 400 });
  }

  const existing = await findClientBill(run.id, company.id);
  if (existing) {
    const invoice = await prisma.invoice.findUnique({ where: { id: existing.invoiceId }, select: { id: true } });
    if (invoice) return NextResponse.json(invoice);
  }

  const gross = round2(entries.reduce((sum, entry) => sum + entry.grossPay, 0));
  const employerMpf = round2(entries.reduce((sum, entry) => sum + entry.employerMpf, 0));
  const term = termFor(terms, company.id);
  const serviceFee = serviceFeeFor(term, entries.length, gross);
  const names = entries.map((entry) => entry.employeeName).filter(Boolean).join(", ");
  const month = periodLabel(run.period);

  const items = [
    {
      name: `Staff wages — ${month}`,
      description: names,
      quantity: 1,
      unitPrice: gross,
      unit: "month",
    },
  ];
  if (employerMpf > 0) {
    items.push({
      name: `Employer MPF — ${month}`,
      description: "Employer contribution for the parked staff",
      quantity: 1,
      unitPrice: employerMpf,
      unit: "month",
    });
  }
  if (serviceFee > 0) {
    items.push({
      name: `HR service fee — ${month}`,
      description:
        term.feeMode === "PERCENT"
          ? `${term.feeValue}% of wages`
          : term.feeMode === "FLAT"
            ? "Monthly service fee"
            : `${term.feeValue} per person`,
      quantity: term.feeMode === "PER_HEAD" ? entries.length : 1,
      unitPrice: term.feeMode === "PER_HEAD" ? term.feeValue : serviceFee,
      unit: term.feeMode === "PER_HEAD" ? "person" : "month",
    });
  }

  const totals = computeTotals(items, 0, 0);
  const defaults = documentDefaultsFrom({});
  const issueDate = new Date();
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextDocumentNumber("invoice"),
      title: `Payroll parking ${month} — ${company.name}`,
      customerName: company.name,
      issueDate,
      dueDate: computeDueDate(issueDate, defaults.paymentDueDays),
      status: "UNPAID",
      notes: `Wages and employer MPF for staff parked at ${company.name} in ${month}. Workers are paid their net pay separately.`,
      terms: defaults.terms,
      reminder: defaults.reminder,
      language: defaults.language,
      paymentDueDays: defaults.paymentDueDays,
      taxRate: 0,
      discount: 0,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      items: { create: items.map(itemCreateFrom) },
    },
    select: { id: true, number: true },
  });

  await rememberClientBill({ runId: run.id, companyId: company.id, invoiceId: invoice.id });
  await logActivity({
    documentType: "invoice",
    documentId: invoice.id,
    type: "CREATED",
    description: `Invoice ${invoice.number} created from payroll ${run.period} for ${company.name}`,
  });

  return NextResponse.json(invoice, { status: 201 });
}
