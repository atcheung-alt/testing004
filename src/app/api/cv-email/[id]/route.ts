import { NextResponse } from "next/server";
import { deleteCvEmail, getCvEmail } from "@/lib/cvEmail";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const draft = await getCvEmail(params.id);
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    return NextResponse.json({ draft });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not open the draft." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCvEmail(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not delete the draft." }, { status: 500 });
  }
}
