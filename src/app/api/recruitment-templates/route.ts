import { NextRequest, NextResponse } from "next/server";
import { listRecruitmentTemplates, saveRecruitmentTemplate } from "@/lib/recruitmentTemplate";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await listRecruitmentTemplates());
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Give this template a name." }, { status: 400 });
  const id = String(body.id || "").trim() || `rt_${Date.now().toString(36)}`;
  const template = await saveRecruitmentTemplate({
    id,
    name,
    role: String(body.role || "").trim(),
    requirements: String(body.requirements || "").trim(),
    paymentDueDays: Number(body.paymentDueDays) || 14,
    language: String(body.language || "EN"),
    terms: String(body.terms || ""),
    feeScalePermanent: Array.isArray(body.feeScalePermanent) ? body.feeScalePermanent : [],
    feeScaleContract: Array.isArray(body.feeScaleContract) ? body.feeScaleContract : [],
  });
  return NextResponse.json(template, { status: 201 });
}
