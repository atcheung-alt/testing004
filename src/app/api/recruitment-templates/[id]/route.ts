import { NextRequest, NextResponse } from "next/server";
import { deleteRecruitmentTemplate, getRecruitmentTemplate, saveRecruitmentTemplate } from "@/lib/recruitmentTemplate";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const current = await getRecruitmentTemplate(params.id);
  if (!current) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || current.name).trim();
  if (!name) return NextResponse.json({ error: "Give this template a name." }, { status: 400 });
  const template = await saveRecruitmentTemplate({
    ...current,
    id: params.id,
    name,
    companyName: body.companyName !== undefined ? String(body.companyName).trim() : current.companyName,
    companyEmail: body.companyEmail !== undefined ? String(body.companyEmail).trim() : current.companyEmail,
    role: body.role !== undefined ? String(body.role).trim() : current.role,
    requirements: body.requirements !== undefined ? String(body.requirements).trim() : current.requirements,
    paymentDueDays: body.paymentDueDays !== undefined ? Number(body.paymentDueDays) || 14 : current.paymentDueDays,
    language: body.language !== undefined ? String(body.language) : current.language,
    terms: body.terms !== undefined ? String(body.terms) : current.terms,
    feeScalePermanent: Array.isArray(body.feeScalePermanent) ? body.feeScalePermanent : current.feeScalePermanent,
    feeScaleContract: Array.isArray(body.feeScaleContract) ? body.feeScaleContract : current.feeScaleContract,
  });
  return NextResponse.json(template);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await deleteRecruitmentTemplate(params.id);
  return NextResponse.json({ ok: true });
}
