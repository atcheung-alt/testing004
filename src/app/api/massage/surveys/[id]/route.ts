import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canOpenPath, isSuperAdmin, loadAccessGroups, pagesForPerson } from "@/lib/accessControl";
import { deleteMassageSurvey, updateMassageSurvey } from "@/lib/massage";

export const dynamic = "force-dynamic";

async function deny(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const stored = await loadAccessGroups();
  const pages = pagesForPerson(user, stored.groups);
  if (!canOpenPath("/massage", pages, isSuperAdmin(user))) {
    return NextResponse.json({ error: "You cannot change this survey." }, { status: 403 });
  }
  return null;
}

function readScore(value: unknown): number | null {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(score) || score < 1 || score > 5) return null;
  return score;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const blocked = await deny();
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  const overall = readScore(body?.overall);
  const focus = readScore(body?.focus);
  const pressure = readScore(body?.pressure);
  const relief = readScore(body?.relief);
  const therapistId = readText(body?.therapistId).trim();
  if (!body || overall == null || focus == null || pressure == null || relief == null || !therapistId) {
    return NextResponse.json({ error: "Check the therapist and the four scores." }, { status: 400 });
  }

  const result = await updateMassageSurvey(params.id, {
    therapistId,
    overall,
    focus,
    pressure,
    relief,
    comment: readText(body.comment),
    guestNickname: readText(body.guestNickname),
    timeSlot: readText(body.timeSlot),
  });
  if (result === "missing") return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  if (result === "invalid") {
    return NextResponse.json({ error: "Check the therapist and the four scores." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const blocked = await deny();
  if (blocked) return blocked;
  const removed = await deleteMassageSurvey(params.id);
  if (!removed) return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
