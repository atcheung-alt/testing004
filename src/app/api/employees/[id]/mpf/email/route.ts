import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { sendMpfFormToEmployee } from "@/lib/mpfForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Email the Individual eMPF Form and the private upload link. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const result = await sendMpfFormToEmployee(params.id, request);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, to: "to" in result ? result.to : null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send the email." }, { status: 502 });
  }
}
