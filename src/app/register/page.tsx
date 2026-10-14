import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getEffectiveCompany } from "@/lib/appSettings";
import RegisterForm from "@/components/RegisterForm";
import CompanyLogo from "@/components/CompanyLogo";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.status !== "PENDING") redirect("/");

  let firstAccount = false;
  try {
    firstAccount = (await prisma.user.count()) === 0;
  } catch {
    firstAccount = false;
  }
  const company = await getEffectiveCompany();

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-10">
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
        <RegisterForm firstAccount={firstAccount} />
      </div>
    </div>
  );
}
