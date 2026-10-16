import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  VALID_RECRUITMENT_STATUSES,
  VALID_RECRUITMENT_LANGUAGES,
  serializeFeeScaleRows,
} from "@/lib/recruitmentTerms";

function agreementDateFrom(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const agreement = await prisma.recruitmentAgreement.findUnique({ where: { id: params.id } });
  if (!agreement) {
    return NextResponse.json({ error: "Recruitment agreement not found." }, { status: 404 });
  }
  return NextResponse.json(agreement);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.recruitmentAgreement.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Recruitment agreement not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.companyName !== undefined && !body.companyName.trim()) {
    return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  }
  if (body.companyEmail !== undefined) {
    if (!body.companyEmail.trim()) {
      return NextResponse.json({ error: "A company email is required." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(body.companyEmail.trim())) {
      return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
    }
  }
  if (body.status !== undefined && !VALID_RECRUITMENT_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid status." }, { status: 400 });
  }
  if (body.language !== undefined && !VALID_RECRUITMENT_LANGUAGES.includes(body.language)) {
    return NextResponse.json({ error: "That's not a valid terms language." }, { status: 400 });
  }

  let agreementDate: Date | undefined;
  if (body.agreementDate !== undefined) {
    const parsed = agreementDateFrom(body.agreementDate);
    if (!parsed) {
      return NextResponse.json({ error: "Enter a valid agreement date." }, { status: 400 });
    }
    if (existing.createdAt.toISOString().slice(0, 10) !== body.agreementDate) {
      agreementDate = parsed;
    }
  }

  const agreement = await prisma.recruitmentAgreement.update({
    where: { id: params.id },
    data: {
      companyName: body.companyName !== undefined ? body.companyName.trim() : undefined,
      companyEmail: body.companyEmail !== undefined ? body.companyEmail.trim() : undefined,
      paymentDueDays:
        body.paymentDueDays !== undefined && Number.isFinite(Number(body.paymentDueDays))
          ? Number(body.paymentDueDays)
          : undefined,
      terms: body.terms !== undefined ? body.terms : undefined,
      feeScalePermanent:
        body.feeScalePermanent !== undefined ? serializeFeeScaleRows(body.feeScalePermanent) : undefined,
      feeScaleContract:
        body.feeScaleContract !== undefined ? serializeFeeScaleRows(body.feeScaleContract) : undefined,
      language: body.language !== undefined ? body.language : undefined,
      status: body.status !== undefined ? body.status : undefined,
      createdAt: agreementDate,
    },
  });

  const changed: string[] = [];
  if (body.companyName !== undefined) changed.push("company name");
  if (body.companyEmail !== undefined) changed.push("company email");
  if (body.paymentDueDays !== undefined) changed.push("payment terms");
  if (body.terms !== undefined) changed.push("terms text");
  if (body.feeScalePermanent !== undefined || body.feeScaleContract !== undefined) {
    changed.push("fee scale");
  }
  if (body.language !== undefined && body.language !== existing.language) changed.push("terms language");
  if (agreementDate) changed.push("agreement date");
  if (body.status !== undefined && body.status !== existing.status) changed.push(`status → ${body.status}`);
  await logActivity({
    documentType: "recruitment",
    documentId: agreement.id,
    type: "EDITED",
    description: changed.length ? `Updated: ${changed.join(", ")}` : "Updated",
  });

  return NextResponse.json(agreement);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.recruitmentAgreement.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Recruitment agreement not found." }, { status: 404 });
  }

  await logActivity({
    documentType: "recruitment",
    documentId: existing.id,
    type: "DELETED",
    description: `Recruitment agreement ${existing.number} deleted`,
  });

  await prisma.recruitmentAgreement.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
