import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canOpenPath, isSuperAdmin, loadAccessGroups, pagesForPerson } from "@/lib/accessControl";
import { retireMassageTherapist } from "@/lib/massage";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const stored = await loadAccessGroups();
  const pages = pagesForPerson(user, stored.groups);
  if (!canOpenPath("/massage", pages, isSuperAdmin(user))) {
    return NextResponse.json({ error: "You cannot change the therapist list." }, { status: 403 });
  }

  const removed = await retireMassageTherapist(params.id);
  if (!removed) return NextResponse.json({ error: "Therapist not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
