import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isCompanyAdmin, isSuper } from "@/lib/access";

export const runtime = "nodejs";

async function editor() {
  const account = await getAccount();
  if (!account || account.status !== "ACTIVE") return null;
  if (isSuper(account) || isCompanyAdmin(account)) return account;
  return null;
}

function sameCompany(account: { companyId: string | null; role: string; isAdmin: boolean }, companyId: string | null) {
  return isSuper(account) || (!!account.companyId && account.companyId === companyId);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const account = await editor();
  if (!account) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!sameCompany(account, existing.companyId)) {
    return NextResponse.json({ error: "You can only change accounts in your company." }, { status: 403 });
  }
  if (!isSuper(account) && existing.role === "SUPER") {
    return NextResponse.json({ error: "You can only change accounts in your company." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : existing.name;
  const status = body.status === "ACTIVE" || body.status === "CANCELLED" || body.status === "PENDING" ? body.status : existing.status;
  if (existing.id === account.id && status !== "ACTIVE") {
    return NextResponse.json({ error: "You can't cancel your own account here." }, { status: 400 });
  }
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { name, status },
    select: { id: true, email: true, name: true, status: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const account = await editor();
  if (!account) return NextResponse.json({ error: "Only an admin can do this." }, { status: 403 });
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (!sameCompany(account, existing.companyId) || (!isSuper(account) && existing.role === "SUPER")) {
    return NextResponse.json({ error: "You can only change accounts in your company." }, { status: 403 });
  }

  const current = account;
  if (current.id === params.id) {
    return NextResponse.json(
      { error: "You can't remove your own account while logged in as it." },
      { status: 400 }
    );
  }

  const count = await prisma.user.count();
  if (count <= 1) {
    return NextResponse.json(
      { error: "Can't remove the last remaining account — that would lock everyone out." },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
