"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

type AccessRequestRow = {
  id: string;
  email: string;
  name: string;
  companyName: string;
  note: string;
};

type CompanyOption = { id: string; name: string };

const CATEGORIES = [
  ["HR_PLUS_STAFF", "HR Plus staff"],
  ["FULL_TIME", "Full-time"],
  ["PART_TIME", "Part-time"],
  ["FREELANCE", "Freelance"],
] as const;

const ROLES = [
  ["ADMIN", "Admin"],
  ["MEMBER", "Member"],
  ["EXTERNAL_ADMIN", "External admin"],
  ["EXTERNAL_MEMBER", "External member"],
] as const;

export default function AccessRequestQueue({
  requests,
  companies,
  saving,
  onDone,
  onError,
}: {
  requests: AccessRequestRow[];
  companies: CompanyOption[];
  saving: boolean;
  onDone: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [drafts, setDrafts] = useState<
    Record<string, { category: string; label: string; companyName: string }>
  >({});
  const [busy, setBusy] = useState(false);

  async function decide(request: AccessRequestRow, action: "approve" | "reject") {
    const draft = drafts[request.id] || {
      category: "HR_PLUS_STAFF",
      label: request.companyName ? "EXTERNAL_ADMIN" : "MEMBER",
      companyName: request.companyName,
    };
    setBusy(true);
    try {
      const res = await fetch(`/api/access-requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name: request.name, ...draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update the request.");
      await onDone();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-ink-muted">{t("No one is waiting for access.")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {requests.map((request) => {
        const draft = drafts[request.id] || {
          category: "HR_PLUS_STAFF",
          label: request.companyName ? "EXTERNAL_ADMIN" : "MEMBER",
          companyName: request.companyName,
        };
        const external = draft.label === "EXTERNAL_ADMIN" || draft.label === "EXTERNAL_MEMBER";
        return (
          <div key={request.id} className="border border-line rounded-xl p-3 flex flex-col gap-2">
            <div>
              <p className="text-sm text-ink">{request.name || request.email}</p>
              <p className="text-xs text-ink-faint">{request.email}</p>
              {request.note && <p className="text-sm text-ink-muted mt-1">{request.note}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                className="input py-1 text-sm"
                aria-label={t("Payroll category")}
                value={draft.category}
                onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: { ...draft, category: event.target.value } }))}
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
              <select
                className="input py-1 text-sm"
                aria-label={t("Role")}
                value={draft.label}
                onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: { ...draft, label: event.target.value } }))}
              >
                {ROLES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
              {external &&
                (companies.length > 0 ? (
                  <select
                    className="input py-1 text-sm"
                    value={draft.companyName}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [request.id]: { ...draft, companyName: event.target.value } }))
                    }
                  >
                    <option value="">{t("Their company")}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.name}>
                        {company.name}
                      </option>
                    ))}
                    {draft.companyName && !companies.some((company) => company.name === draft.companyName) && (
                      <option value={draft.companyName}>{draft.companyName}</option>
                    )}
                  </select>
                ) : (
                  <input
                    className="input py-1 text-sm"
                    placeholder={t("Their company")}
                    value={draft.companyName}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [request.id]: { ...draft, companyName: event.target.value } }))
                    }
                  />
                ))}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={saving || busy} onClick={() => decide(request, "approve")}>
                {t("Approve")}
              </button>
              <button type="button" className="btn-secondary" disabled={saving || busy} onClick={() => decide(request, "reject")}>
                {t("Reject")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
