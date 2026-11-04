import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.generalExpense.findUnique({
      where: { id: params.id },
      select: { fileName: true, mimeType: true, fileData: true },
    });
    if (!row || !row.fileData) return NextResponse.json({ error: "No receipt on this expense." }, { status: 404 });
    const comma = row.fileData.indexOf(",");
    const base64 = comma >= 0 ? row.fileData.slice(comma + 1) : row.fileData;
    const bytes = Buffer.from(base64, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${row.fileName || "receipt"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not open that receipt." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.generalExpense.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not delete that expense." }, { status: 500 });
  }
}
