import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isGoogleLoginConfigured } from "@/lib/googleOAuth";
import { getEffectiveCompany } from "@/lib/appSettings";
import LoginForm from "@/components/LoginForm";
import CompanyLogo from "@/components/CompanyLogo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect(searchParams.next || "/");
  }

  let mode: "setup" | "login" = "login";
  let databaseError = false;
  try {
    const userCount = await prisma.user.count();
    mode = userCount === 0 ? "setup" : "login";
  } catch (err) {
    console.error("Login page could not reach the database:", err);
    databaseError = true;
  }
  const company = await getEffectiveCompany();

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-gradient px-4">
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
            <span className="font-display font-semibold text-lg tracking-tight">
              {company.shortName || company.name}
            </span>
          )}
        </div>
        <LoginForm
          mode={mode}
          next={searchParams.next || "/"}
          googleEnabled={isGoogleLoginConfigured()}
          errorCode={databaseError ? "database" : searchParams.error}
        />
      </div>
    </div>
  );
}
