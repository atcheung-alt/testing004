import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccount, isSuper } from "@/lib/access";

export const dynamic = "force-dynamic";

function cleanLabel(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 24);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const account = await getAccount();
  if (!account || !isSuper(account)) {
    return NextResponse.json({ error: "Only the top admin can do this." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const label = cleanLabel(typeof body.label === "string" ? body.label : "");
  if (!name || !label) {
    return NextResponse.json({ error: "Enter a company name and a label." }, { status: 400 });
  }
  try {
    const company = await prisma.company.update({ where: { id: params.id }, data: { name, label } });
    return NextResponse.json(company);
  } catch {
    return NextResponse.json({ error: "Could not save that company." }, { status: 409 });
  }
}
