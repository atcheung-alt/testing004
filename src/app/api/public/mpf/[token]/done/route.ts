import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { ensureMpfFormColumns } from "@/lib/mpfForm";

export const dynamic = "force-dynamic";

/** Mark eMPF online registration finished. Does not upload a file. */
export async function POST(_request: NextRequest, { params }: { params: { token: string } }) {
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({ where: { mpfFormToken: params.token } });
  if (!employee) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });

  if (!employee.mpfFormCompletedAt) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        mpfFormCompletedAt: new Date(),
        mpfVerifiedAt: employee.mpfVerifiedAt ?? new Date(),
      },
    });
    await logActivity({
      documentType: "employee",
      documentId: employee.id,
      type: "EDITED",
      actor: "CLIENT",
      actorName: employee.name,
      description: `${employee.name} finished eMPF registration online`,
    });
  }

  return NextResponse.json({ success: true });
}
