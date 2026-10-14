import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const company = await prisma.company.findUnique({ where: { id: params.id }, include: { groups: true } });
  if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const have = new Set(company.groups.map((group) => group.number));
  const numbers = body.preset
    ? [1, 2, 3].filter((number) => !have.has(number))
    : [Math.max(0, ...company.groups.map((group) => group.number)) + 1];
  if (numbers.length > 0) {
    await prisma.companyGroup.createMany({
      data: numbers.map((number) => ({ companyId: company.id, number })),
    });
  }
  const groups = await prisma.companyGroup.findMany({ where: { companyId: company.id }, orderBy: { number: "asc" } });
  return NextResponse.json(groups);
}
