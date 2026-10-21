import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const companies = await prisma.employerCompany.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { employees: true } } },
  });
  return NextResponse.json(
    companies.map((company) => ({
      id: company.id,
      name: company.name,
      sortOrder: company.sortOrder,
      employeeCount: company._count.employees,
    }))
  );
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!name) {
    return NextResponse.json({ error: "Please enter a company name." }, { status: 400 });
  }

  const last = await prisma.employerCompany.findFirst({ orderBy: { sortOrder: "desc" } });
  const company = await prisma.employerCompany.create({
    data: { name, sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  return NextResponse.json(company, { status: 201 });
}
