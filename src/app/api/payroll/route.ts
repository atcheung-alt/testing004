import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  isValidPeriod,
  payBasisFor,
  rateFor,
  defaultUnitsWorked,
  defaultMpfApplicable,
  computeEntryTotals,
} from "@/lib/payroll";
import { approvedUnitsFor } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

/** List every payroll run, most recent period first, with just enough
 *  per-run totals for the list page (full entry detail is fetched
 *  separately per-run via GET /api/payroll/[id]). */
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const runs = await prisma.payrollRun.findMany({
    orderBy: { period: "desc" },
    include: {
      entries: { select: { grossPay: true, netPay: true } },
    },
  });

  const summarized = runs.map((run: any) => ({
    id: run.id,
    period: run.period,
    status: run.status,
    finalizedAt: run.finalizedAt,
    createdAt: run.createdAt,
    employeeCount: run.entries.length,
    totalGross: run.entries.reduce((sum: number, e: any) => sum + e.grossPay, 0),
    totalNet: run.entries.reduce((sum: number, e: any) => sum + e.netPay, 0),
  }));

  return NextResponse.json(summarized);
}

/**
 * Start a new payroll run for a calendar month: snapshots every currently
 * ACTIVE employee's pay setup (employment type, pay basis, rate) into a
 * PayrollEntry, with a sensible default for units worked (see
 * defaultUnitsWorked in src/lib/payroll.ts) that staff can adjust before
 * finalizing. One run per period — trying to create a second one for a
 * period that already has a run returns the existing run's id instead of
 * erroring blindly, so the UI can offer to just open it.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const period = body.period;
  if (!isValidPeriod(period)) {
    return NextResponse.json({ error: "A valid period (YYYY-MM) is required." }, { status: 400 });
  }

  const existing = await prisma.payrollRun.findUnique({ where: { period } });
  if (existing) {
    return NextResponse.json(
      { error: `A payroll run for this period already exists.`, id: existing.id },
      { status: 409 }
    );
  }

  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" } });
  const entryRows = await Promise.all(
    employees.map(async (emp) => {
      const payBasis = payBasisFor(emp.employmentType, emp.payRateType);
      const rate = rateFor(payBasis, emp.salary, emp.payRate);
      const approved = await approvedUnitsFor(emp.id, period, payBasis);
      const unitsWorked = approved === null ? defaultUnitsWorked(payBasis, period) : approved;
      const mpfApplicable = defaultMpfApplicable(emp.employmentType, emp.startDate, period);
      const totals = computeEntryTotals({
        payBasis,
        rate,
        unitsWorked,
        mpfApplicable,
        employmentType: emp.employmentType,
        startDate: emp.startDate,
        period,
      });
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeTitle: emp.title,
        employeeEmail: emp.personalEmail || emp.email || emp.companyEmail,
        employmentType: emp.employmentType,
        payBasis,
        rate,
        unitsWorked,
        mpfApplicable,
        ...totals,
      };
    })
  );

  const run = await prisma.payrollRun.create({
    data: {
      period,
      entries: {
        create: entryRows,
      },
    },
    include: { entries: { orderBy: { employeeName: "asc" } } },
  });

  await logActivity({
    documentType: "payroll",
    documentId: run.id,
    type: "CREATED",
    description: `Payroll run created for ${period} (${employees.length} employee${employees.length === 1 ? "" : "s"})`,
  });

  return NextResponse.json(run, { status: 201 });
}
