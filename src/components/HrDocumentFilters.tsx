"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const TYPES = [
  ["FULL_TIME", "Full time"],
  ["PART_TIME", "Part time"],
  ["FREELANCE", "Freelance"],
] as const;

const KINDS = [
  ["all", "All documents"],
  ["contract", "Contract"],
  ["payslip", "Payslip"],
  ["salary", "Salary report"],
  ["ir56b", "IR56B"],
] as const;

export default function HrDocumentFilters({
  companies,
  years,
}: {
  companies: { id: string; name: string }[];
  years: string[];
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/hr/documents${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="input py-1 text-sm max-w-[14rem]"
        aria-label={t("Company")}
        value={searchParams.get("company") || ""}
        onChange={(event) => setParam("company", event.target.value)}
      >
        <option value="">{t("All companies")}</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      <select
        className="input py-1 text-sm max-w-[12rem]"
        aria-label={t("Employment type")}
        value={searchParams.get("type") || ""}
        onChange={(event) => setParam("type", event.target.value)}
      >
        <option value="">{t("All types")}</option>
        {TYPES.map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </select>
      <select
        className="input py-1 text-sm max-w-[12rem]"
        aria-label={t("Document")}
        value={searchParams.get("kind") || "all"}
        onChange={(event) => setParam("kind", event.target.value === "all" ? "" : event.target.value)}
      >
        {KINDS.map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)}
          </option>
        ))}
      </select>
      <select
        className="input py-1 text-sm max-w-[8rem]"
        aria-label={t("Year")}
        value={searchParams.get("year") || years[0] || ""}
        onChange={(event) => setParam("year", event.target.value)}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
