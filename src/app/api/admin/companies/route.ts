import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

function cleanLabel(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
}

export async function GET() {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const companies = await prisma.company.findMany({
    orderBy: { label: "asc" },
    include: { _count: { select: { users: true } }, groups: { orderBy: { number: "asc" } } },
  });
  return NextResponse.json(companies);
}

export async function POST(request: NextRequest) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const label = cleanLabel(typeof body.label === "string" ? body.label : "");
  if (!name || !label) {
    return NextResponse.json({ error: "Enter a company name and a label." }, { status: 400 });
  }
  try {
    const company = await prisma.company.create({
      data: { name, label, groups: { create: [{ number: 1 }, { number: 2 }, { number: 3 }] } },
      include: { groups: { orderBy: { number: "asc" } } },
    });
    return NextResponse.json(company, { status: 201 });
  } catch {
    return NextResponse.json({ error: "That label is already used." }, { status: 409 });
  }
}
