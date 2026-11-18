import { NextRequest, NextResponse } from "next/server";
import { sendDueMpfEmails } from "@/lib/mpfForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily check. Sends the MPF email one month after onboarding was signed. */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sent = await sendDueMpfEmails();
  return NextResponse.json({ sent });
}
