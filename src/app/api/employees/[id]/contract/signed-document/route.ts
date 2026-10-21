import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { canManageEmployee } from "@/lib/documentAccess";

/**
 * Staff-facing download of an employee's uploaded signed PDF — the
 * alternative to a drawn signature on the employment contract. Mirrors
 * /api/quotations/[id]/signed-document, but admin-gated like every other
 * /api/employees/[id]/contract/* route (`:id` here is the employeeId, same
 * as the sibling pdf route, not the contract's own id).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await canManageEmployee(params.id))) {
    const denied = await requireAdminApi();
    return denied || NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { contract: true },
  });

  if (!employee?.contract?.signedDocumentData) {
    return NextResponse.json({ error: "No uploaded document for this contract." }, { status: 404 });
  }

  const base64 = employee.contract.signedDocumentData.split(",")[1] || "";
  const buffer = Buffer.from(base64, "base64");
  const filename =
    employee.contract.signedDocumentName || `${employee.name.replace(/\s+/g, "-")}-signed-document.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    },
  });
}
