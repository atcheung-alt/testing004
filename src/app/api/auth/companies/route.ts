import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureHomeCompany } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureHomeCompany();
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, label: true },
    orderBy: [{ isHome: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(companies);
}
