import CompanyLogo from "@/components/CompanyLogo";
import type { PublicCompany } from "@/components/PublicCompanyHeader";

/** Shared frame for the public booking pages. Presentation only. */
export default function PublicBookingShell({
  company,
  children,
}: {
  company: PublicCompany;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          {company.logoData ? (
            <CompanyLogo
              logoData={company.logoData}
              logoDataDark={company.logoDataDark}
              name={company.name}
              className="h-8 object-contain"
            />
          ) : (
            <span className="font-display text-lg font-semibold text-ink">{company.shortName || company.name}</span>
          )}
          {company.logoData && (
            <span className="text-sm text-ink-muted truncate">{company.shortName || company.name}</span>
          )}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>
    </div>
  );
}
