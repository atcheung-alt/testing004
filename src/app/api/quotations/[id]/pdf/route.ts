import { NextRequest, NextResponse } from "next/server";
import { buildQuotationPdf } from "@/lib/pdf/build";
import { pdfContentDisposition } from "@/lib/pdf/language";
import { pdfLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { quotationVisible } from "@/lib/documentAccess";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await quotationVisible(params.id))) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }
  const language = pdfLanguageFromRequest(request);
  const built = await buildQuotationPdf(params.id, language);
  if (!built) {
    return NextResponse.json({ error: "Quotation not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(`${built.number}.pdf`, language),
    },
  });
}
