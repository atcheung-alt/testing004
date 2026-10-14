import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, label: true },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(companies);
}
