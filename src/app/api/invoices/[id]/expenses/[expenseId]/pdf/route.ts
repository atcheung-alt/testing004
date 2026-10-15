import { NextRequest, NextResponse } from "next/server";
import { buildExpensePdf } from "@/lib/pdf/buildExpense";
import { pdfContentDisposition } from "@/lib/pdf/language";
import { pdfLanguageFromRequest } from "@/lib/i18n/downloadLanguage";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; expenseId: string } }
) {
  const language = pdfLanguageFromRequest(request);
  const built = await buildExpensePdf(params.id, params.expenseId, language);
  if (!built) {
    return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": pdfContentDisposition(`${built.number}.pdf`, language),
    },
  });
}
