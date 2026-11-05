import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDataUrl } from "@/lib/mailer";
import { ensureGeneralExpenseTable } from "@/lib/generalExpense";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const amount = Number(body.amount);
  const spentAt = new Date(String(body.spentAt || ""));
  const category = String(body.category || "").trim();
  if (!name) return NextResponse.json({ error: "Enter an expense name." }, { status: 400 });
  if (!category || category === "Other (Custom)") {
    return NextResponse.json({ error: "Enter a category." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }
  if (Number.isNaN(spentAt.getTime())) {
    return NextResponse.json({ error: "Enter a valid date." }, { status: 400 });
  }

  let fileName = "";
  let mimeType = "";
  let fileData = "";
  if (typeof body.fileData === "string" && body.fileData) {
    const parsed = parseDataUrl(body.fileData);
    if (!parsed) return NextResponse.json({ error: "That receipt could not be read." }, { status: 400 });
    if (parsed.buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "The receipt is larger than 8MB." }, { status: 400 });
    }
    fileName = String(body.fileName || "receipt").slice(0, 180);
    mimeType = parsed.contentType;
    fileData = body.fileData;
  }

  const invoiceId = String(body.invoiceId || "").trim();
  const expenseType = invoiceId ? "INVOICE" : "GENERAL";

  async function createRow() {
    return prisma.generalExpense.create({
      data: {
        name,
        category,
        amount,
        spentAt,
        vendor: String(body.vendor || "").trim(),
        notes: String(body.notes || "").trim(),
        invoiceId: invoiceId || null,
        invoiceNumber: invoiceId ? String(body.invoiceNumber || "").trim() : "",
        expenseType,
        fileName,
        mimeType,
        fileData,
      },
      select: { id: true },
    });
  }

  try {
    const row = await createRow();
    return NextResponse.json({ id: row.id, expenseType }, { status: 201 });
  } catch {
    try {
      await ensureGeneralExpenseTable();
      const row = await createRow();
      return NextResponse.json({ id: row.id, expenseType }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "Could not save the expense." }, { status: 500 });
    }
  }
}
