import { prisma } from "@/lib/prisma";
import { getEffectiveCompany } from "@/lib/appSettings";
import CompanyLogo from "@/components/CompanyLogo";
import RequestAccessForm from "@/components/RequestAccessForm";

export const dynamic = "force-dynamic";

export default async function RequestAccessPage({
  searchParams,
}: {
  searchParams: { email?: string; name?: string };
}) {
  let email = typeof searchParams.email === "string" ? searchParams.email : "";
  const name = typeof searchParams.name === "string" ? searchParams.name : "";
  if (email) {
    try {
      const existing = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });
      if (existing) email = "";
    } catch (err) {
      console.error("Request access page could not check the email:", err);
    }
  }
  const company = await getEffectiveCompany();

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-gradient px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-6">
          {company.logoData ? (
            <CompanyLogo
              logoData={company.logoData}
              logoDataDark={company.logoDataDark}
              name={company.shortName || company.name}
              className="h-11 max-w-full object-contain"
            />
          ) : (
            <span className="font-display font-semibold text-lg tracking-tight">{company.shortName || company.name}</span>
          )}
        </div>
        <RequestAccessForm initialEmail={email} initialName={name} />
      </div>
    </div>
  );
}
