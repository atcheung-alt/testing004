import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureHomeCompany, uniqueCompanyLabel } from "@/lib/access";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  await ensureHomeCompany();
  const companies = await prisma.company.findMany({
    orderBy: [{ isHome: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true } }, groups: { orderBy: { number: "asc" } } },
  });
  return NextResponse.json(companies);
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
  }
  const label = await uniqueCompanyLabel(name);
  try {
    const company = await prisma.company.create({
      data: { name, label },
      include: { groups: { orderBy: { number: "asc" } } },
    });
    return NextResponse.json(company, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not save that company." }, { status: 409 });
  }
}
