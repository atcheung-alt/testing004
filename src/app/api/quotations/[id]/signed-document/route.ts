import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quotationVisible } from "@/lib/documentAccess";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationVisible(params.id))) {
    return NextResponse.json({ error: "No uploaded document for this quotation." }, { status: 404 });
  }
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.id },
    select: { signedDocumentData: true, signedDocumentName: true, number: true },
  });

  if (!quotation?.signedDocumentData) {
    return NextResponse.json({ error: "No uploaded document for this quotation." }, { status: 404 });
  }

  const base64 = quotation.signedDocumentData.split(",")[1] || "";
  const buffer = Buffer.from(base64, "base64");
  const filename = quotation.signedDocumentName || `${quotation.number}-signed-document.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
