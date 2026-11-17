import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { logClientView } from "@/lib/activity";
import { contractDocumentTitleFor } from "@/lib/employeeContractTerms";
import { contractSignLinkExpired, ensureContractSignColumns } from "@/lib/employeeContract";

export type PublicEmployeeContractView = {
  id: string;
  employeeName: string;
  // "Employment Contract" or "Independent Contractor Agreement" — see
  // contractDocumentTitleFor. Drives the heading shown on the public
  // signing page instead of hardcoding "Employment Contract" there.
  documentTitle: string;
  status: string;
  createdAt: string;
  terms: string;
  probationPeriod: string | null;
  contractEndDate: string | null;
  workLocation: string | null;
  workSchedule: string | null;
  signed: boolean;
  signable: boolean;
  expired: boolean;
  signerName: string | null;
  signedAt: string | null;
  // Alternative to a drawn signature — see signedDocumentData on the
  // EmployeeContract model. Only the filename is exposed here, never the
  // base64 document itself; hasSignedDocument distinguishes "signed by
  // upload" from "signed by drawing" even before signedDocumentName loads.
  signedDocumentName: string | null;
  hasSignedDocument: boolean;
  company: {
    name: string;
    shortName?: string;
    logoData?: string | null;
    logoDataDark?: string | null;
  };
};

/**
 * Token-scoped, read-only contract view shared by the public API route and
 * the /contract-sign/[token] page's server-side initial render — same
 * pattern as getPublicRecruitmentView. No authentication — the random
 * signing token itself is the access control.
 */
export async function getPublicEmployeeContractView(token: string): Promise<PublicEmployeeContractView | null> {
  const contract = await prisma.employeeContract.findUnique({
    where: { signingToken: token },
    include: { employee: { select: { name: true, employmentType: true } } },
  });
  if (!contract) return null;

  await ensureContractSignColumns();
  await logClientView("employee", contract.employeeId);

  const locked = contract.status === "CANCELLED";
  const expired = contractSignLinkExpired(contract);
  const company = await getEffectiveCompany();

  return {
    id: contract.id,
    employeeName: contract.employee.name,
    documentTitle: contractDocumentTitleFor(contract.employee.employmentType),
    status: contract.status,
    createdAt: contract.createdAt.toISOString(),
    terms: contract.terms,
    probationPeriod: contract.probationPeriod,
    contractEndDate: contract.contractEndDate ? contract.contractEndDate.toISOString() : null,
    workLocation: contract.workLocation,
    workSchedule: contract.workSchedule,
    signed: Boolean(contract.signedAt),
    signable: !locked && !contract.signedAt && !expired,
    expired,
    signerName: contract.signerName,
    signedAt: contract.signedAt ? contract.signedAt.toISOString() : null,
    signedDocumentName: contract.signedDocumentName,
    hasSignedDocument: Boolean(contract.signedDocumentData),
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      logoDataDark: company.logoDataDark,
    },
  };
}
