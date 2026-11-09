import { prisma } from "@/lib/prisma";
import { approvedUnitsFor } from "@/lib/timesheets";
import {
  computeEntryTotals,
  defaultMpfApplicable,
  defaultUnitsWorked,
  isUnpaidIntern,
  payBasisFor,
  proratedDays,
  rateFor,
  salaryMonthMark,
} from "@/lib/payroll";

type EmployeePay = {
  id: string;
  name: string;
  title: string;
  personalEmail: string | null;
  email: string | null;
  companyEmail: string | null;
  employmentType: string | null;
  payRateType: string | null;
  salary: number;
  payRate: number;
  startDate: Date | null;
};

/** One payroll row for this month, including a mid-month start. */
export async function payrollEntryData(emp: EmployeePay, period: string) {
  const payBasis = payBasisFor(emp.employmentType, emp.payRateType);
  const rate = rateFor(payBasis, emp.salary, emp.payRate);
  const approved = await approvedUnitsFor(emp.id, period, payBasis);
  let unitsWorked = approved === null ? defaultUnitsWorked(payBasis, period) : approved;
  const mark = salaryMonthMark(emp.startDate, period);
  const split =
    mark === "prorated" && payBasis === "SALARY" && emp.startDate ? proratedDays(emp.startDate, period) : null;
  if (split && approved === null) unitsWorked = split.days;
  const mpfApplicable = defaultMpfApplicable(emp.employmentType, emp.startDate, period);
  const totals = computeEntryTotals({
    payBasis,
    rate,
    unitsWorked,
    mpfApplicable,
    employmentType: emp.employmentType,
    startDate: emp.startDate,
    period,
    salaryMonthDays: split?.monthDays,
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
}

export function startedAfterPeriod(startDate: Date | null, period: string): boolean {
  if (!startDate) return false;
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0, 16, 0, 0));
  return startDate.getTime() > end.getTime();
}

export function canPayEmployee(emp: { employmentType: string | null; salary: number; payRate: number }) {
  return !isUnpaidIntern(emp);
}

export async function loadPayableEmployee(employeeId: string) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp || !canPayEmployee(emp)) return null;
  return emp;
}
