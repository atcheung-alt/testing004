import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isCompanyAdmin, isSuper } from "@/lib/access";

export const dynamic = "force-dynamic";

async function ownCompany() {
  const account = await getAccount();
  if (!account || !account.companyId || !(isCompanyAdmin(account) || isSuper(account))) return null;
  if (isSuper(account) && !isCompanyAdmin(account)) return null;
  return account;
}

export async function GET() {
  const account = await ownCompany();
  if (!account?.companyId) {
    return NextResponse.json({ error: "Only a company admin can do this." }, { status: 403 });
  }
  const [company, users] = await Promise.all([
    prisma.company.findUnique({ where: { id: account.companyId }, include: { groups: { orderBy: { number: "asc" } } } }),
    prisma.user.findMany({
      where: { companyId: account.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, status: true, role: true, sections: true, groupId: true },
    }),
  ]);
  return NextResponse.json({ company, users });
}

export async function PATCH(request: NextRequest) {
  const account = await ownCompany();
  if (!account?.companyId) {
    return NextResponse.json({ error: "Only a company admin can do this." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (body.userId) {
    const user = await prisma.user.findFirst({ where: { id: body.userId, companyId: account.companyId } });
    if (!user) return NextResponse.json({ error: "That account is not in your company." }, { status: 404 });
    if (user.id === account.id && body.status && body.status !== "ACTIVE") {
      return NextResponse.json({ error: "You can't cancel your own account here." }, { status: 400 });
    }
    const role = body.role === "COMPANY_ADMIN" || body.role === "MEMBER" ? body.role : user.role === "SUPER" ? "COMPANY_ADMIN" : user.role;
    const status = body.status === "ACTIVE" || body.status === "CANCELLED" || body.status === "PENDING" ? body.status : user.status;
    let groupId = user.groupId;
    let sections = user.sections;
    if (body.groupId === null || typeof body.groupId === "string") {
      if (body.groupId === null) {
        groupId = null;
        sections = "[]";
      } else {
        const group = await prisma.companyGroup.findFirst({ where: { id: body.groupId, companyId: account.companyId } });
        if (!group) return NextResponse.json({ error: "Choose a group in this company." }, { status: 400 });
        groupId = group.id;
        sections = group.sections;
      }
    }
    const saved = await prisma.user.update({
      where: { id: user.id },
      data: { role: role === "SUPER" ? "COMPANY_ADMIN" : role, status, groupId, sections, isAdmin: false },
    });
    return NextResponse.json({ id: saved.id });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
  }
  try {
    const company = await prisma.company.update({ where: { id: account.companyId }, data: { name } });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "That label is already used." }, { status: 409 });
  }
}
