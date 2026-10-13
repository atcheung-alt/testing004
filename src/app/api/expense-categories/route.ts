import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultExpenseCategories } from "@/lib/ensureExpenseCategories";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaultExpenseCategories();
  const categories = await prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Please enter a category name." }, { status: 400 });
  }
  if (name.toLowerCase() === "others") {
    return NextResponse.json(
      { error: "\"Others\" is already built in and doesn't need to be added." },
      { status: 400 }
    );
  }

  const all = await prisma.expenseCategory.findMany({ select: { name: true } });
  const existing = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "That category already exists." }, { status: 409 });
  }

  const count = all.length;
  const category = await prisma.expenseCategory.create({
    data: { name, sortOrder: count },
  });

  return NextResponse.json(category, { status: 201 });
}
