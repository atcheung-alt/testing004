import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import { logClientView } from "@/lib/activity";

export type PublicRecruitmentView = {
  id: string;
  number: string;
  companyName: string;
  status: string;
  createdAt: string;
  terms: string;
  signed: boolean;
  signable: boolean;
  signerName: string | null;
  signerCompanyName: string | null;
  signerJobTitle: string | null;
  signedAt: string | null;
  // Alternative to a drawn signature — see signedDocumentData on the
  // RecruitmentAgreement model. Only the filename is exposed here (never
  // the base64 document itself, which would bloat this read-only view);
  // hasSignedDocument still lets the page distinguish "signed by upload"
  // from "signed by drawing" even before signedDocumentName loads in.
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
 * Token-scoped, read-only recruitment agreement view shared by the public
 * API route and the /recruitment-sign/[token] page's server-side initial
 * render. No authentication — the random signing token itself is the
 * access control, same as the quotation signing flow.
 */
export async function getPublicRecruitmentView(token: string): Promise<PublicRecruitmentView | null> {
  const agreement = await prisma.recruitmentAgreement.findUnique({
    where: { signingToken: token },
  });
  if (!agreement) return null;

  await logClientView("recruitment", agreement.id);

  const locked = agreement.status === "CANCELLED";
  const company = await getEffectiveCompany(agreement.companyId);

  return {
    id: agreement.id,
    number: agreement.number,
    companyName: agreement.companyName,
    status: agreement.status,
    createdAt: agreement.createdAt.toISOString(),
    terms: agreement.terms,
    signed: Boolean(agreement.signedAt),
    signable: !locked && !agreement.signedAt,
    signerName: agreement.signerName,
    signerCompanyName: agreement.signerCompanyName,
    signerJobTitle: agreement.signerJobTitle,
    signedAt: agreement.signedAt ? agreement.signedAt.toISOString() : null,
    signedDocumentName: agreement.signedDocumentName,
    hasSignedDocument: Boolean(agreement.signedDocumentData),
    company: {
      name: company.name,
      shortName: company.shortName,
      logoData: company.logoData,
      logoDataDark: company.logoDataDark,
    },
  };
}
