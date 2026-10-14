import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isSuper } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getAccount();
  if (!account || !isSuper(account)) {
    return NextResponse.json({ error: "Only the top admin can do this." }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: true,
      sections: true,
      isAdmin: true,
      companyId: true,
      company: { select: { id: true, name: true, label: true } },
    },
  });
  return NextResponse.json(users);
}
