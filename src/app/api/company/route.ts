import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isCompanyAdmin, isSuper, parseSections } from "@/lib/access";

export const dynamic = "force-dynamic";

function cleanLabel(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
}

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
    prisma.company.findUnique({ where: { id: account.companyId } }),
    prisma.user.findMany({
      where: { companyId: account.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, status: true, role: true, sections: true },
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
    const company = await prisma.company.findUnique({ where: { id: account.companyId }, select: { sections: true } });
    const allowed = parseSections(company?.sections);
    const sections = Array.isArray(body.sections)
      ? JSON.stringify(parseSections(JSON.stringify(body.sections)).filter((id) => allowed.includes(id)))
      : user.sections;
    const saved = await prisma.user.update({
      where: { id: user.id },
      data: { role: role === "SUPER" ? "COMPANY_ADMIN" : role, status, sections, isAdmin: false },
    });
    return NextResponse.json({ id: saved.id });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const label = cleanLabel(typeof body.label === "string" ? body.label : "");
  if (!name || !label) {
    return NextResponse.json({ error: "Enter a company name and a label." }, { status: 400 });
  }
  try {
    const company = await prisma.company.update({ where: { id: account.companyId }, data: { name, label } });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "That label is already used." }, { status: 409 });
  }
}
