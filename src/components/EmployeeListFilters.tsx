"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/client";

const TYPES = [
  ["FULL_TIME", "Full time"],
  ["PART_TIME", "Part time"],
  ["FREELANCE", "Freelance"],
] as const;

export default function EmployeeListFilters({ companies }: { companies: { id: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/hr/employees${params.toString() ? `?${params}` : ""}`);
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
    </div>
  );
}
