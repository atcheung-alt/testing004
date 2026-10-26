import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureMassageTables, packSurveyNote } from "@/lib/massage";

export const dynamic = "force-dynamic";

function score(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 5) return null;
  return number;
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  await ensureMassageTables();
  const link = await prisma.massageEventLink.findUnique({
    where: { token: params.token },
    select: { id: true, invoiceId: true },
  });
  if (!link) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const timeSlot = typeof body.timeSlot === "string" ? body.timeSlot.trim().slice(0, 80) : "";
  const guestNickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 80) : "";
  const therapistId = typeof body.therapistId === "string" ? body.therapistId : "";
  const overall = score(body.overall);
  const focus = score(body.focus);
  const pressure = score(body.pressure);
  const relief = score(body.relief);
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 500) : "";
  const language = body.language === "en" ? "en" : "zh";

  if (!therapistId || overall == null || focus == null || pressure == null || relief == null) {
    return NextResponse.json({ error: "Incomplete survey." }, { status: 400 });
  }

  const therapist = await prisma.massageTherapist.findUnique({
    where: { id: therapistId },
    select: { id: true, active: true },
  });
  if (!therapist?.active) return NextResponse.json({ error: "Incomplete survey." }, { status: 400 });

  await prisma.massageSurvey.create({
    data: {
      linkId: link.id,
      invoiceId: link.invoiceId,
      therapistId,
      overall,
      focus,
      pressure,
      relief,
      comment: packSurveyNote(guestNickname, timeSlot, comment),
      language,
    },
  });

  return NextResponse.json({ ok: true });
}
