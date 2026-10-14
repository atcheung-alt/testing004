import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseSections } from "@/lib/access";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

const ROLES = new Set(["SUPER", "COMPANY_ADMIN", "MEMBER"]);
const STATUSES = new Set(["PENDING", "ACTIVE", "CANCELLED"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
  const account = gate.account;
  const body = await request.json().catch(() => ({}));
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const role = typeof body.role === "string" && ROLES.has(body.role) ? body.role : existing.role;
  const status = typeof body.status === "string" && STATUSES.has(body.status) ? body.status : existing.status;
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const companyId = body.companyId === null ? null : typeof body.companyId === "string" ? body.companyId : existing.companyId;
  const sections = Array.isArray(body.sections) ? JSON.stringify(parseSections(JSON.stringify(body.sections))) : existing.sections;

  if (role !== "SUPER" && !companyId && existing.role !== "SUPER" && existing.companyId) {
    return NextResponse.json({ error: "Choose a company for this account." }, { status: 400 });
  }
  if (existing.id === account.id && (status !== "ACTIVE" || role !== "SUPER")) {
    return NextResponse.json({ error: "You can't remove your own top admin access." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      name: name || existing.name,
      role,
      status,
      companyId: role === "SUPER" ? null : companyId,
      sections,
      isAdmin: role === "SUPER",
    },
  });
  return NextResponse.json({ id: user.id, status: user.status, role: user.role });
}
