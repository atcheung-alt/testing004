import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { entries: { orderBy: { employeeName: "asc" } } },
  });
  if (!run) {
    return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  }
  return NextResponse.json(run);
}

/** Marks the run finished once every row is paid. Rows stay editable. */
export async function PATCH(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const run = await prisma.payrollRun.findUnique({
    where: { id: params.id },
    include: { entries: { select: { paidAt: true } } },
  });
  if (!run) return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  if (run.entries.some((entry) => !entry.paidAt)) {
    return NextResponse.json(
      { error: "All employees must be marked as PAID before finalizing this run." },
      { status: 400 }
    );
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: "FINALIZED", finalizedAt: run.finalizedAt ?? new Date() },
  });
  return NextResponse.json(updated);
}

/** A payroll run can always be deleted now — there's no "finalized, historical
 *  record" state protecting it anymore. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const run = await prisma.payrollRun.findUnique({ where: { id: params.id } });
  if (!run) {
    return NextResponse.json({ error: "Payroll run not found." }, { status: 404 });
  }

  await prisma.payrollRun.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
