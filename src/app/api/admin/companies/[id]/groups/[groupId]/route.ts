import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSections } from "@/lib/access";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const group = await prisma.companyGroup.findFirst({ where: { id: params.groupId, companyId: params.id } });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const sections = JSON.stringify(parseSections(JSON.stringify(Array.isArray(body.sections) ? body.sections : [])));
  const saved = await prisma.companyGroup.update({ where: { id: group.id }, data: { sections } });
  await prisma.user.updateMany({ where: { groupId: group.id }, data: { sections } });
  return NextResponse.json(saved);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string; groupId: string } }) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const group = await prisma.companyGroup.findFirst({ where: { id: params.groupId, companyId: params.id } });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  await prisma.user.updateMany({ where: { groupId: group.id }, data: { groupId: null, sections: "[]" } });
  await prisma.companyGroup.delete({ where: { id: group.id } });
  return NextResponse.json({ ok: true });
}
