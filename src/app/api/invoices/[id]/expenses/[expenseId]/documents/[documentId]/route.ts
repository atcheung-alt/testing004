import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expenseFileBytes } from "@/lib/expenseFiles";

async function loadDocument(invoiceId: string, expenseId: string, documentId: string) {
  const document = await prisma.expenseDocument.findUnique({
    where: { id: documentId },
    include: { expense: { select: { id: true, invoiceId: true } } },
  });
  if (!document || document.expense.id !== expenseId || document.expense.invoiceId !== invoiceId) {
    return null;
  }
  return document;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; expenseId: string; documentId: string } }
) {
  const document = await loadDocument(params.id, params.expenseId, params.documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const bytes = expenseFileBytes(document.data);
  const safeName = document.fileName.replace(/["\r\n]/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeName}"`,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; expenseId: string; documentId: string } }
) {
  const document = await loadDocument(params.id, params.expenseId, params.documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  await prisma.expenseDocument.delete({ where: { id: document.id } });
  return NextResponse.json({ success: true });
}
