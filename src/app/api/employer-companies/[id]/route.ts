import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { removeClientTerm, saveClientTerm } from "@/lib/clientService";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const existing = await prisma.employerCompany.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const touchesFee = "feeMode" in body || "feeValue" in body;
  if (!name && !touchesFee) {
    return NextResponse.json({ error: "Please enter a company name." }, { status: 400 });
  }

  const company = name
    ? await prisma.employerCompany.update({
        where: { id: params.id },
        data: { name },
      })
    : existing;
  const term = touchesFee ? await saveClientTerm(existing.id, body.feeMode, body.feeValue) : null;
  return NextResponse.json({ ...company, feeMode: term?.feeMode, feeValue: term?.feeValue });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const existing = await prisma.employerCompany.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Company not found." }, { status: 404 });

  await prisma.employerCompany.delete({ where: { id: params.id } });
  await removeClientTerm(params.id);
  return NextResponse.json({ success: true });
}
