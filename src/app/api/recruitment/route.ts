import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/lib/numbering";
import { generateSigningToken } from "@/lib/signing";
import { logActivity } from "@/lib/activity";
import { companyWhere, ownerCompanyId } from "@/lib/access";
import { dateRangeFilter } from "@/lib/dateRange";
import {
  RECRUITMENT_TERMS_TEMPLATES,
  renderRecruitmentTerms,
  buildFeeScaleTables,
  serializeFeeScaleRows,
  normalizeFeeScaleRows,
  DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS,
  DEFAULT_FEE_SCALE_PERMANENT,
  DEFAULT_FEE_SCALE_CONTRACT,
  VALID_RECRUITMENT_STATUSES,
  VALID_RECRUITMENT_LANGUAGES,
  type RecruitmentLanguage,
} from "@/lib/recruitmentTerms";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || undefined;
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const from = request.nextUrl.searchParams.get("from") || undefined;
  const to = request.nextUrl.searchParams.get("to") || undefined;

  const agreements = await prisma.recruitmentAgreement.findMany({
    where: {
      ...(await companyWhere()),
      status: status || undefined,
      createdAt: dateRangeFilter(from, to),
      OR: q
        ? [
            { companyName: { contains: q, mode: "insensitive" } },
            { companyEmail: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agreements);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (!companyName) {
    return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  }
  const companyEmail = typeof body.companyEmail === "string" ? body.companyEmail.trim() : "";
  if (!companyEmail) {
    return NextResponse.json({ error: "A company email is required." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(companyEmail)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  const paymentDueDays = Number.isFinite(Number(body.paymentDueDays))
    ? Number(body.paymentDueDays)
    : DEFAULT_RECRUITMENT_PAYMENT_DUE_DAYS;
  if (body.status !== undefined && !VALID_RECRUITMENT_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "That's not a valid status." }, { status: 400 });
  }
  const language: RecruitmentLanguage = VALID_RECRUITMENT_LANGUAGES.includes(body.language)
    ? body.language
    : "EN";

  const feeScalePermanentRows = normalizeFeeScaleRows(body.feeScalePermanent, DEFAULT_FEE_SCALE_PERMANENT);
  const feeScaleContractRows = normalizeFeeScaleRows(body.feeScaleContract, DEFAULT_FEE_SCALE_CONTRACT);

  const terms =
    typeof body.terms === "string" && body.terms.trim()
      ? body.terms
      : renderRecruitmentTerms(
          RECRUITMENT_TERMS_TEMPLATES[language],
          companyName,
          paymentDueDays,
          buildFeeScaleTables({ permanent: feeScalePermanentRows, contract: feeScaleContractRows }, language)
        );

  const number = await nextDocumentNumber("recruitment");

  const agreement = await prisma.recruitmentAgreement.create({
    data: {
      number,
      companyId: await ownerCompanyId(),
      companyName,
      companyEmail,
      paymentDueDays,
      terms,
      feeScalePermanent: serializeFeeScaleRows(feeScalePermanentRows),
      feeScaleContract: serializeFeeScaleRows(feeScaleContractRows),
      language,
      status: body.status || "DRAFT",
      signingToken: generateSigningToken(),
    },
  });

  await logActivity({
    documentType: "recruitment",
    documentId: agreement.id,
    type: "CREATED",
    description: `Recruitment agreement ${agreement.number} created`,
  });

  return NextResponse.json(agreement, { status: 201 });
}
