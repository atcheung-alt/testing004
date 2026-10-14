import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { clearAdminGate } from "@/lib/adminGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  clearSession();
  clearAdminGate();
  return NextResponse.json({ success: true });
}
