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
  const label = cleanLabel(typeof body.label === "string" ? body.label : "");
  if (!name || !label) {
    return NextResponse.json({ error: "Enter a company name and a label." }, { status: 400 });
  }
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
