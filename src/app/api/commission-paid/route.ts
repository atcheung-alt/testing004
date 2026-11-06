import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/accessControl";
import { setCommissionPaid } from "@/lib/commissionPaid";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getCurrentUser();
  if (!session || (!session.isAdmin && !isSuperAdmin(session))) {
    return NextResponse.json({ error: "Only an admin can mark billing paid." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const invoiceId = String(body.invoiceId || "").trim();
  const colleagueName = String(body.colleagueName || "").trim();
  if (!invoiceId) {
    return NextResponse.json({ error: "Choose a billing row." }, { status: 400 });
  }
  const paidOn = await setCommissionPaid(invoiceId, colleagueName, Boolean(body.paid));
  return NextResponse.json({ paid: Boolean(paidOn), paidOn });
}
