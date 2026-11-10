import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { deleteDriveFile, isDriveConfigured } from "@/lib/googleDrive";
import { ensureMpfFormColumns } from "@/lib/mpfForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Delete the saved MPF file only. The employee stays on the MPF list. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    select: { id: true, mpfFormDriveFileId: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  if (employee.mpfFormDriveFileId && isDriveConfigured()) {
    await deleteDriveFile(employee.mpfFormDriveFileId);
  }
  await prisma.employee.update({
    where: { id: employee.id },
    data: { mpfFormDriveFileId: null, mpfFormDriveUrl: null, mpfFormCompletedAt: null },
  });
  return NextResponse.json({ ok: true });
}
