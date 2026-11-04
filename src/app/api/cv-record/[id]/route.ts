import { NextResponse } from "next/server";
import { deleteCvRecord } from "@/lib/cvRecord";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await deleteCvRecord(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not delete the CV." }, { status: 500 });
  }
}
