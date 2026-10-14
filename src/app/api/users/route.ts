import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isCompanyAdmin, isSuper } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function editor() {
  const account = await getAccount();
  if (!account || account.status !== "ACTIVE") return null;
  if (isSuper(account) || isCompanyAdmin(account)) return account;
  return null;
}

export async function GET() {
  const account = await editor();
  if (!account) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  const users = await prisma.user.findMany({
    where: isSuper(account) ? {} : { companyId: account.companyId },
    select: { id: true, email: true, name: true, status: true, role: true, companyId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const account = await editor();
  if (!account) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Please enter their email." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already added." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      status: "ACTIVE",
      role: "MEMBER",
      companyId: isSuper(account) ? null : account.companyId,
      sections: "[]",
    },
    select: { id: true, email: true, name: true, status: true, role: true, companyId: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
