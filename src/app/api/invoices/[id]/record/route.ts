import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { deleteSignedRecord, saveSignedRecord } from "@/lib/recordFiles";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: { id: true, number: true, recordFileId: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  try {
    const saved = await saveSignedRecord({
      kind: "invoice",
      id: invoice.id,
      number: invoice.number,
      existingFileId: invoice.recordFileId,
      fileName: file.name,
      mimeType: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json(saved);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "The file could not be saved." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: { id: true, recordFileId: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    await deleteSignedRecord({ kind: "invoice", id: invoice.id, fileId: invoice.recordFileId });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "The file could not be deleted." }, { status: 400 });
  }
}
