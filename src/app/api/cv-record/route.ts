import { NextRequest, NextResponse } from "next/server";
import { listCvRecords, saveCvRecord } from "@/lib/cvRecord";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cvs = await listCvRecords();
    return NextResponse.json({ cvs });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not load saved CVs." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !String((body as { id?: string }).id || "").trim()) {
    return NextResponse.json({ error: "Missing CV id." }, { status: 400 });
  }
  try {
    const cv = await saveCvRecord(body as Record<string, unknown>);
    return NextResponse.json({ cv });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not save the CV." }, { status: 500 });
  }
}
