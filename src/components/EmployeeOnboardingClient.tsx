"use client";

import { useState } from "react";
import { CheckCircle2, Send, Loader2, AlertCircle, Upload, FileText, X } from "lucide-react";
import { formatDate } from "@/lib/calculations";
import CompanyLogo from "@/components/CompanyLogo";
import type { PublicEmployeeOnboardingView } from "@/lib/publicEmployeeOnboarding";
import { useT } from "@/lib/i18n/client";

const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

type DocumentKey = "addressProof" | "bankStatement" | "hkidDocument";

const DOCUMENT_LABELS: Record<DocumentKey, { title: string; hint: string }> = {
  addressProof: { title: "Proof of address *", hint: "A recent utility bill, bank letter, or tenancy agreement" },
  bankStatement: { title: "Bank statement *", hint: "A recent statement showing your name and account number" },
  hkidDocument: { title: "HKID card *", hint: "A clear photo or scan of both sides" },
};

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this file — please try again."));
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not read this file — please try again."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.72;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 2_800_000 && quality > 0.4) {
        quality -= 0.08;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 3_800_000) {
        reject(new Error("This file is too large — please keep it under 3 MB."));
        return;
      }
      resolve(data);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this file — please try again."));
    };
    image.src = url;
  });
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string; data: any }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error:
        res.status === 413
          ? "The files are too large to send. Please use a smaller photo or PDF."
          : "The form could not be saved. Please try again.",
      data: null,
    };
  }
  return { ok: res.ok, error: data.error, data };
}

function CompanyHeader({ company }: { company: PublicEmployeeOnboardingView["company"] }) {
  return (
    <div className="flex justify-end mb-2">
      {company.logoData ? (
        <CompanyLogo
          logoData={company.logoData}
          logoDataDark={company.logoDataDark}
          name={company.name}
          className="h-9 object-contain"
        />
      ) : (
        <span className="font-display text-xl font-semibold text-brand-800">{company.name}</span>
      )}
    </div>
  );
}

type FormState = {
  surnameEn: string;
  givenNameEn: string;
  surnameChinese: string;
  givenNameChinese: string;
  hkid: string;
  gender: string;
  birthday: string;
  nationality: string;
  phone: string;
  personalEmail: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  bankName: string;
  bankCode: string;
  bankCardName: string;
  bankAccount: string;
};

export default function EmployeeOnboardingClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicEmployeeOnboardingView;
}) {
  const [view, setView] = useState(initial);
  const [documents, setDocuments] = useState<Record<DocumentKey, { data: string | null; name: string | null }>>({
    addressProof: { data: null, name: null },
    bankStatement: { data: null, name: null },
    hkidDocument: { data: null, name: null },
  });
  const [documentErrors, setDocumentErrors] = useState<Record<DocumentKey, string | null>>({
    addressProof: null,
    bankStatement: null,
    hkidDocument: null,
  });
  const [declarationAccuracy, setDeclarationAccuracy] = useState(false);
  const [declarationConsent, setDeclarationConsent] = useState(false);
  const [form, setForm] = useState<FormState>({
    surnameEn: initial.surnameEn || "",
    givenNameEn: initial.givenNameEn || "",
    surnameChinese: "",
    givenNameChinese: "",
    hkid: "",
    gender: "",
    birthday: "",
    nationality: "",
    phone: "",
    personalEmail: initial.prefillEmail || "",
    address: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    bankName: "",
    bankCode: "",
    bankCardName: "",
    bankAccount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

  async function prepareDocument(file: File): Promise<string> {
    if (file.type === "application/pdf") {
      if (file.size > MAX_DOCUMENT_BYTES) {
        throw new Error(t("This file is too large — please keep it under 3 MB."));
      }
      return readFileAsDataUrl(file);
    }
    return compressImage(file);
  }

  function handleDocumentChange(key: DocumentKey, file: File | null) {
    if (!file) {
      setDocuments((d) => ({ ...d, [key]: { data: null, name: null } }));
      return;
    }
    if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      setDocumentErrors((d) => ({ ...d, [key]: t("Please upload a PDF, JPG, or PNG file.") }));
      return;
    }
    setDocumentErrors((d) => ({ ...d, [key]: null }));
    prepareDocument(file)
      .then((data) => setDocuments((d) => ({ ...d, [key]: { data, name: file.name } })))
      .catch((err: unknown) => {
        setDocumentErrors((d) => ({
          ...d,
          [key]: err instanceof Error ? err.message : t("Could not read this file — please try again."),
        }));
      });
  }

  const allDocumentsAttached = (Object.keys(DOCUMENT_LABELS) as DocumentKey[]).every(
    (key) => !!documents[key].data
  );
  const canSubmit = allDocumentsAttached && declarationAccuracy && declarationConsent && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allDocumentsAttached) {
      setError(t("Please attach all three documents before submitting."));
      return;
    }
    if (!declarationAccuracy || !declarationConsent) {
      setError(t("Please confirm both declarations before submitting."));
      return;
    }
    setSubmitting(true);
    try {
      for (const key of Object.keys(DOCUMENT_LABELS) as DocumentKey[]) {
        const uploaded = await postJson(`/api/public/onboarding/${token}/document`, {
          kind: key,
          data: documents[key].data,
        });
        if (!uploaded.ok) throw new Error(uploaded.error || t("Could not upload your documents. Please try again in a moment."));
      }
      const saved = await postJson(`/api/public/onboarding/${token}/submit`, {
        ...form,
        documentsAlreadyUploaded: true,
        declarationAccuracy,
        declarationConsent,
      });
      if (!saved.ok) throw new Error(saved.error || t("Something went wrong. Please try again."));
      setView(saved.data);
    } catch (err: unknown) {
      setError(t(err instanceof Error ? err.message : "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (view.completed) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 flex flex-col items-center text-center gap-4">
        <CompanyHeader company={view.company} />
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
          <CheckCircle2 size={24} />
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">{t("Thanks, {name}", { name: view.name })}</h1>
        <p className="text-sm text-ink-muted">
          {view.completedAt
            ? t("Your details have been received on {date}. If anything needs correcting, please contact HR directly — this link can't be used to submit again.", { date: formatDate(view.completedAt) })
            : t("Your details have been received. If anything needs correcting, please contact HR directly — this link can't be used to submit again.")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
      <CompanyHeader company={view.company} />

      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">{t("Hi, {name}", { name: view.name })}</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          {t("Please fill in your personal details below. Once submitted, this form can't be changed through this link again, so double-check everything before sending.")}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-6">
        {error && (
          <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t("Personal Information")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("English surname *")}</label>
              <input
                type="text"
                className="input"
                value={form.surnameEn}
                onChange={(e) => update("surnameEn", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("English given name *")}</label>
              <input
                type="text"
                className="input"
                value={form.givenNameEn}
                onChange={(e) => update("givenNameEn", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Chinese surname")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("If you have one")}
                value={form.surnameChinese}
                onChange={(e) => update("surnameChinese", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("Chinese given name")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("If you have one")}
                value={form.givenNameChinese}
                onChange={(e) => update("givenNameChinese", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("HKID *")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. A123456(7)")}
                value={form.hkid}
                onChange={(e) => update("hkid", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Gender *")}</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => update("gender", e.target.value)}
                required
              >
                <option value="">{t("Select…")}</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {t(g)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t("Date of birth *")}</label>
              <input
                type="date"
                className="input"
                value={form.birthday}
                onChange={(e) => update("birthday", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Nationality *")}</label>
              <input
                type="text"
                className="input"
                value={form.nationality}
                onChange={(e) => update("nationality", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Phone number *")}</label>
              <input
                type="tel"
                className="input"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Personal email *")}</label>
              <input
                type="email"
                className="input"
                value={form.personalEmail}
                onChange={(e) => update("personalEmail", e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{t("Address *")}</label>
              <textarea
                className="input min-h-[70px]"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t("Emergency Contact")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("Contact name *")}</label>
              <input
                type="text"
                className="input"
                value={form.emergencyContactName}
                onChange={(e) => update("emergencyContactName", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Relationship")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. Spouse, Parent")}
                value={form.emergencyContactRelationship}
                onChange={(e) => update("emergencyContactRelationship", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("Contact number *")}</label>
              <input
                type="tel"
                className="input"
                value={form.emergencyContactPhone}
                onChange={(e) => update("emergencyContactPhone", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t("Bank Details")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">{t("Bank name *")}</label>
              <input
                type="text"
                className="input"
                value={form.bankName}
                onChange={(e) => update("bankName", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Bank code")}</label>
              <input
                type="text"
                className="input"
                value={form.bankCode}
                onChange={(e) => update("bankCode", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("Account holder *")}</label>
              <input
                type="text"
                className="input"
                value={form.bankCardName}
                onChange={(e) => update("bankCardName", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("Account number *")}</label>
              <input
                type="text"
                className="input"
                value={form.bankAccount}
                onChange={(e) => update("bankAccount", e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{t("Documents")}</h2>
            <p className="text-sm text-ink-muted mt-0.5">{t("Please attach all three documents below (PDF, JPG, or PNG). Photos are reduced automatically. A PDF must be under 3 MB.")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.keys(DOCUMENT_LABELS) as DocumentKey[]).map((key) => {
              const label = DOCUMENT_LABELS[key];
              const doc = documents[key];
              const docError = documentErrors[key];
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label className="label">{t(label.title)}</label>
                  <p className="text-xs text-ink-muted -mt-1">{t(label.hint)}</p>
                  {doc.name ? (
                    <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                      <FileText size={15} className="shrink-0 text-brand-700" />
                      <span className="truncate flex-1">{doc.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDocumentChange(key, null)}
                        className="text-ink-muted hover:text-danger-600 shrink-0"
                        aria-label={t("Remove {label}", { label: t(label.title) })}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2 justify-center border border-dashed border-neutral-300 rounded-lg px-3 py-4 text-sm text-ink-muted cursor-pointer hover:border-brand-500 hover:text-brand-700">
                      <Upload size={15} />
                      <span>{t("Upload file")}</span>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => handleDocumentChange(key, e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                  {docError && <span className="text-xs text-danger-600">{docError}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{t("Declarations")}</h2>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={declarationAccuracy}
              onChange={(e) => setDeclarationAccuracy(e.target.checked)}
              required
            />
            <span>{t("I declare that the information and documents I have provided are true, complete and accurate.")}</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={declarationConsent}
              onChange={(e) => setDeclarationConsent(e.target.checked)}
              required
            />
            <span>{t("I consent to the Company collecting, storing and using this information for employment and statutory purposes.")}</span>
          </label>
        </div>

        <button type="submit" disabled={!canSubmit} className="btn-primary self-start">
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {submitting ? t("Submitting…") : t("Submit my details")}
        </button>
      </form>
    </div>
  );
}
