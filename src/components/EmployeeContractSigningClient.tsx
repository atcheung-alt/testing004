"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Upload,
  FileText,
  PenLine,
  X,
} from "lucide-react";
import PublicSignaturePad from "@/components/PublicSignaturePad";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import CompanyLogo from "@/components/CompanyLogo";
import { formatDate } from "@/lib/calculations";
import type { PublicEmployeeContractView } from "@/lib/publicEmployeeContract";
import { useT } from "@/lib/i18n/client";

function SignedSummary({
  view,
  justSigned,
}: {
  view: PublicEmployeeContractView;
  justSigned?: { signerName: string; signedAt: string; signedDocumentName?: string | null } | null;
}) {
  const signerName = justSigned?.signerName || view.signerName;
  const signedAt = justSigned?.signedAt || view.signedAt;
  const signedDocumentName = justSigned?.signedDocumentName || view.signedDocumentName;
  const hasSignedDocument = Boolean(justSigned?.signedDocumentName) || view.hasSignedDocument;
  const t = useT();
  const company = view.company.shortName || view.company.name;
  const who = signerName || t("you");

  return (
    <div className="card p-6 sm:p-8 flex flex-col items-center text-center gap-3">
      <CheckCircle2 size={44} className="text-emerald-500" />
      <h2 className="font-display text-xl font-semibold text-ink">
        {justSigned ? t("Contract signed — thank you!") : t("This contract has already been signed")}
      </h2>
      <p className="text-sm text-ink-muted max-w-md">
        {justSigned
          ? t("A copy of your signed contract has been emailed to you and to {company}. Our team will review it shortly.", { company })
          : signedAt
            ? t("Signed by {name} on {date}.", { name: who, date: formatDate(signedAt) })
            : t("Signed by {name}.", { name: who })}
      </p>

      {hasSignedDocument ? (
        <div className="mt-2 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
            <FileText size={16} className="text-brand-600" />
            <span className="text-sm text-ink">{signedDocumentName || t("Signed document")}</span>
          </div>
          <p className="text-xs text-ink-faint">{t("Uploaded by {name}", { name: signerName || "" })}</p>
        </div>
      ) : null}
    </div>
  );
}

function ContractText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
      )}
    </>
  );
}

/** The stored contract uses § and ** as layout marks for the PDF. The signing page shows the words only. */
function ContractTerms({ terms }: { terms: string }) {
  let clause = 0;
  return (
    <>
      {terms.split(/\n\n+/).map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("§")) {
          clause += 1;
          return (
            <p key={index} className="text-sm text-ink">
              <span className="font-semibold">{clause}. </span>
              <ContractText text={trimmed.slice(1)} />
            </p>
          );
        }
        return (
          <p key={index} className="text-sm text-ink whitespace-pre-line">
            <ContractText text={trimmed} />
          </p>
        );
      })}
    </>
  );
}

export default function EmployeeContractSigningClient({
  token,
  initial,
}: {
  token: string;
  initial: PublicEmployeeContractView;
}) {
  const [view] = useState(initial);
  const [signerName, setSignerName] = useState("");
  const [method, setMethod] = useState<"draw" | "upload">("draw");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState<{
    signerName: string;
    signedAt: string;
    signedDocumentName?: string | null;
  } | null>(null);
  const t = useT();

  const nameValid = signerName.trim().length > 0;
  const proofProvided = method === "draw" ? Boolean(signatureData) : Boolean(uploadedFileData);
  const canSubmit = nameValid && proofProvided && !submitting;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file if they change their mind
    if (!file) return;

    setUploadError(null);
    setUploadedFileData(null);
    setUploadedFileName(null);

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError(t("Please upload a PDF file."));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(t("That file is too large — please keep it under 15 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFileData(typeof reader.result === "string" ? reader.result : null);
      setUploadedFileName(file.name);
    };
    reader.onerror = () => setUploadError(t("Couldn't read that file — please try again."));
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/employee-contract/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: signerName.trim(),
          signatureData: method === "draw" ? signatureData : undefined,
          signedDocumentData: method === "upload" ? uploadedFileData : undefined,
          signedDocumentName: method === "upload" ? uploadedFileName : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Something went wrong. Please try again."));
      setJustSigned({
        signerName: signerName.trim(),
        signedAt: data.signedAt,
        signedDocumentName: method === "upload" ? uploadedFileName : null,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (view.signed || justSigned) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
        <SignedSummary view={view} justSigned={justSigned} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6">
      <div className="flex flex-col items-center text-center gap-2">
        {view.company.logoData ? (
          <CompanyLogo
            logoData={view.company.logoData}
            logoDataDark={view.company.logoDataDark}
            name={view.company.name}
            className="h-10 object-contain mb-2"
          />
        ) : (
          <h1 className="font-display text-xl font-semibold text-ink">{view.company.name}</h1>
        )}
        <h2 className="font-display text-lg font-semibold text-ink">{view.documentTitle}</h2>
        <p className="text-sm text-ink-muted">{t("Prepared for {name}", { name: view.employeeName })}</p>
        <div className="mt-1">
          <DownloadPdfButton url={`/api/public/employee-contract/${token}/pdf`} />
        </div>
      </div>

      <div className="card p-5 sm:p-6 max-h-[500px] overflow-y-auto flex flex-col gap-3">
        <ContractTerms terms={view.terms} />
      </div>

      {view.expired ? (
        <div className="card p-5 sm:p-6 bg-amber-50 text-amber-700">
          {t("This link has expired. The 3 days to sign have passed. Ask HR Plus to send the contract email again.")}
        </div>
      ) : view.signable ? (
        <div className="card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <ShieldCheck size={16} className="text-brand-500" />
{t("Sign below to accept this contract.")}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="label">{t("Your full name *")}</label>
            <input
              type="text"
              className="input"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t("Confirm your acceptance *")}</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMethod("draw")}
                className={
                  method === "draw"
                    ? "stamp gap-1 border-brand-500 text-brand-500"
                    : "stamp gap-1 border-line text-ink-muted"
                }
              >
                <PenLine size={13} /> {t("Draw signature")}
              </button>
              <button
                type="button"
                onClick={() => setMethod("upload")}
                className={
                  method === "upload"
                    ? "stamp gap-1 border-brand-500 text-brand-500"
                    : "stamp gap-1 border-line text-ink-muted"
                }
              >
                <Upload size={13} /> {t("Upload signed PDF")}
              </button>
            </div>

            {method === "draw" ? (
              <PublicSignaturePad fullName={signerName} value={signatureData} onChange={setSignatureData} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-ink-muted">
{t("Download the contract, print it, sign it, scan or photograph it back into a PDF, then upload it here.")}
                </p>
                {uploadedFileName ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={16} className="text-brand-600 shrink-0" />
                      <span className="text-sm text-ink truncate">{uploadedFileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFileData(null);
                        setUploadedFileName(null);
                      }}
                      aria-label={t("Remove file")}
                      className="text-ink-faint hover:text-danger-500 transition-colors shrink-0"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/30 transition-colors">
                    <Upload size={22} className="text-ink-faint" />
                    <span className="text-sm text-ink-muted">{t("Click to choose a PDF")}</span>
                    <span className="text-xs text-ink-faint">{t("PDF only, up to 15 MB")}</span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
                {uploadError && <p className="text-xs text-danger-500">{uploadError}</p>}
              </div>
            )}
          </div>

          <p className="text-xs text-ink-faint">
            {method === "draw"
              ? t("By signing, you confirm that you have reviewed this contract in full and accept its terms. Your name, signature, and IP address will be recorded with the timestamp of signing.")
              : t("By signing, you confirm that you have reviewed this contract in full and accept its terms. Your name, uploaded document, and IP address will be recorded with the timestamp of signing.")}
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="btn-primary self-start"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {submitting ? t("Submitting…") : t("Accept & Sign")}
          </button>
        </div>
      ) : (
        <div className="card p-5 sm:p-6">
          <p className="text-sm text-ink-muted">{t("This contract is no longer available for signing.")}</p>
        </div>
      )}
    </div>
  );
}
