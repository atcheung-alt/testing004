import { NextRequest, NextResponse } from "next/server";
import { remindAllUnsignedContracts } from "@/lib/employeeContract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily check. Emails the staff account that sent a contract once 3 days pass with no signature. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sent = await remindAllUnsignedContracts();
  return NextResponse.json({ sent });
}
