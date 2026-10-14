import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperWithGate } from "@/lib/adminGate";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperWithGate();
  if ("error" in gate) return gate.error;
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
      groupId: true,
      company: { select: { id: true, name: true, label: true } },
      group: { select: { id: true, number: true } },
    },
  });
  return NextResponse.json(users);
}
