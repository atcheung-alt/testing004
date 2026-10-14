import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSections } from "@/lib/access";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

function cleanLabel(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
  }
  const current = await prisma.company.findUnique({ where: { id: params.id } });
  if (!current) return NextResponse.json({ error: "Company not found." }, { status: 404 });
  const label = typeof body.label === "string" && body.label.trim() ? cleanLabel(body.label) : current.label;
  const sections = Array.isArray(body.sections) ? JSON.stringify(parseSections(JSON.stringify(body.sections))) : undefined;
  try {
    const company = await prisma.company.update({
      where: { id: params.id },
      data: { name, label, ...(sections !== undefined ? { sections } : {}) },
    });
    if (sections !== undefined) {
      await prisma.user.updateMany({
        where: { companyId: company.id, role: { not: "SUPER" } },
        data: { sections },
      });
    }
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "That label is already used." }, { status: 409 });
  }
}
