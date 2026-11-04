import { NextResponse } from "next/server";
import { deleteRecruitmentTemplate } from "@/lib/recruitmentTemplate";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  await deleteRecruitmentTemplate(params.id);
  return NextResponse.json({ ok: true });
}
