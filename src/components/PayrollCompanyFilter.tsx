"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";

export default function PayrollCompanyFilter({
  runId,
  companies,
  selected,
  query = "",
}: {
  runId: string;
  companies: { id: string; name: string }[];
  selected: string;
  query?: string;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <select
      className="input py-1 text-sm max-w-[16rem]"
      aria-label={t("Company")}
      value={selected}
      onChange={(event) => {
        const params = new URLSearchParams();
        if (event.target.value) params.set("company", event.target.value);
        if (query) params.set("q", query);
        router.push(`/hr/payroll/${runId}${params.toString() ? `?${params}` : ""}`);
      }}
    >
      <option value="">{t("All companies")}</option>
      {companies.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </select>
  );
}
