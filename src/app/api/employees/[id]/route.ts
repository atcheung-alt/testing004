import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { employeeFieldsFrom } from "@/lib/employees";
import { logActivity } from "@/lib/activity";
import { getCurrentUser, requireAdminApi } from "@/lib/auth";
import { canManageEmployee, employeeScopeFor } from "@/lib/documentAccess";

// Every handler in this file reads/writes full Employee rows — HKID, bank
// details, salary included — so all of them are admin-only. The staff
// detail/edit views for a single employee don't call this GET at all; the
// detail page queries Prisma directly (narrowed for non-admins), and only
// an admin ever reaches the edit page that would PATCH here.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { leaveRequests: { orderBy: { createdAt: "desc" } } },
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  return NextResponse.json(employee);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }
  const scope = await employeeScopeFor(await getCurrentUser());

  const existing = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  // List preview edits one field without resending the whole record.
  if (body.surnameEn === undefined && (body.companyId !== undefined || body.nickname !== undefined)) {
    const data: { companyId?: string | null; nickname?: string | null } = {};
    if (scope.mode === "company" && body.companyId !== undefined) {
      const company = body.companyId
        ? await prisma.employerCompany.findUnique({ where: { id: String(body.companyId) }, select: { name: true } })
        : null;
      if (!company || company.name.trim().toLowerCase() !== scope.companyName.trim().toLowerCase()) {
        return NextResponse.json({ error: "You can only keep workers in your own company." }, { status: 403 });
      }
    }
    if (body.companyId !== undefined) {
      const companyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
      if (companyId) {
        const company = await prisma.employerCompany.findUnique({ where: { id: companyId } });
        if (!company) {
          return NextResponse.json({ error: "That company doesn't exist." }, { status: 400 });
        }
      }
      data.companyId = companyId;
    }
    if (body.nickname !== undefined) {
      const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 40) : "";
      data.nickname = nickname || null;
    }
    const employee = await prisma.employee.update({ where: { id: params.id }, data });
    return NextResponse.json(employee);
  }

  const fields = employeeFieldsFrom(body);
  if (fields.error) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const { error, ...data } = fields;
  if (data.companyId) {
    const company = await prisma.employerCompany.findUnique({ where: { id: data.companyId } });
    if (!company) {
      return NextResponse.json({ error: "That company doesn't exist." }, { status: 400 });
    }
  }
  const employee = await prisma.employee.update({ where: { id: params.id }, data });

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "EDITED",
    description: `Employee record for ${employee.name} updated`,
  });

  return NextResponse.json(employee);
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    const denied = await requireAdminApi();
    return denied || NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const existing = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  await logActivity({
    documentType: "employee",
    documentId: existing.id,
    type: "DELETED",
    description: `Employee record for ${existing.name} deleted`,
  });

  // Cascades to every LeaveRequest belonging to this employee (see
  // onDelete: Cascade on LeaveRequest.employee in schema.prisma).
  await prisma.employee.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
