import { NextRequest, NextResponse } from "next/server";
import { buildInvoicePdf } from "@/lib/pdf/build";
import { pdfContentDisposition } from "@/lib/pdf/language";
import { pdfLanguageFromRequest } from "@/lib/i18n/downloadLanguage";
import { invoiceVisible } from "@/lib/documentAccess";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await invoiceVisible(params.id))) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }
  const language = pdfLanguageFromRequest(request);
  const built = await buildInvoicePdf(params.id, language);
  if (!built) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(`${built.number}.pdf`, language),
    },
  });
}
