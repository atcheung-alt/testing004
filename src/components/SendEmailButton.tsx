"use client";

import { useRef, useState } from "react";
import { Mail, X, CheckCircle2, AlertCircle, Loader2, Paperclip } from "lucide-react";
import Portal from "@/components/Portal";
import { useAppLanguage, useT } from "@/lib/i18n/client";
import { appLanguageToPdf } from "@/lib/i18n/language";
import type { PdfDownloadLanguage } from "@/lib/pdf/language";

// Mirrors the limits enforced server-side in src/lib/emailAttachments.ts —
// duplicated as literals (rather than imported) so this client component
// doesn't pull that file's server-only `mailer.ts` import into the browser
// bundle. Keep these two in sync if the server limits ever change.
const MAX_EMAIL_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8MB per file

type PickedAttachment = { name: string; size: number; dataUrl: string };

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

type Props = {
  kind: "quotations" | "invoices" | "recruitment" | "employees";
  id: string;
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  emailValid: boolean;
  /** Offer a per-send CC field, in addition to any standing CC set in Settings. */
  showCc?: boolean;
  /** Override the default `/api/{kind}/{id}/email` POST target — needed for
   *  sub-resources like an employee's contract, which lives at
   *  `/api/employees/{id}/contract/email` instead. */
  endpoint?: string;
  /** Button label and modal heading — defaults to a plain "Send email" for
   *  the initial send. Pass something like "Send follow-up email" for a
   *  second, distinctly-labeled button on the same page (e.g. an unpaid
   *  invoice's payment reminder) so the two aren't visually interchangeable. */
  label?: string;
  /** Tags this send as a follow-up/reminder rather than the initial send —
   *  forwarded to the API route so the activity timeline logs "Follow-up
   *  reminder emailed to ..." instead of the generic "Emailed to ...". */
  isFollowUp?: boolean;
};

type Status =
  | { type: "idle" }
  | { type: "sending" }
  | { type: "success"; to: string }
  | { type: "error"; message: string };

export default function SendEmailButton({
  kind,
  id,
  defaultTo,
  defaultSubject,
  defaultBody,
  emailValid,
  showCc = false,
  endpoint,
  label = "Send email",
  isFollowUp = false,
}: Props) {
  const t = useT();
  const appLanguage = useAppLanguage();
  const [open, setOpen] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<PdfDownloadLanguage>(appLanguageToPdf(appLanguage));
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [attachments, setAttachments] = useState<PickedAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const toValid = emailRe.test(to.trim());

  // Comma/semicolon-separated list of extra recipients for this one send —
  // case by case, on top of any standing CC configured in Settings.
  const ccList = cc
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
  const ccValid = ccList.every((e) => emailRe.test(e));

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    setAttachError(null);

    if (attachments.length + incoming.length > MAX_EMAIL_ATTACHMENTS) {
      setAttachError(t("You can attach up to {count} files.", { count: MAX_EMAIL_ATTACHMENTS }));
      return;
    }
    const tooBig = incoming.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) {
      setAttachError(t("\"{name}\" is larger than {size}MB.", { name: tooBig.name, size: MAX_ATTACHMENT_BYTES / (1024 * 1024) }));
      return;
    }

    try {
      const added = await Promise.all(
        incoming.map(async (f) => ({ name: f.name, size: f.size, dataUrl: await readFileAsDataUrl(f) }))
      );
      setAttachments((prev) => [...prev, ...added]);
    } catch {
      setAttachError(t("Could not read one of the selected files."));
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function send() {
    if (!toValid) {
      setStatus({ type: "error", message: t("Please enter a valid recipient email address.") });
      return;
    }
    if (!ccValid) {
      setStatus({ type: "error", message: t("One of the CC email addresses doesn't look valid.") });
      return;
    }
    setStatus({ type: "sending" });
    try {
      const res = await fetch(endpoint || `/api/${kind}/${id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          cc: ccList,
          subject,
          body,
          isFollowUp,
          pdfLanguage,
          attachments: attachments.map((a) => ({ filename: a.name, data: a.dataUrl })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send the email.");
      setStatus({ type: "success", to: data.to || to.trim() });
    } catch (err: any) {
      setStatus({ type: "error", message: err.message });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus({ type: "idle" });
          setAttachments([]);
          setAttachError(null);
          setOpen(true);
        }}
        className="btn-secondary"
        title={emailValid ? t("Send by email") : t("Add a customer email to enable sending")}
      >
        <Mail size={15} /> {t(label)}
      </button>

      {open && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm animate-fade-in"
            onClick={() => status.type !== "sending" && setOpen(false)}
          />
          <div className="relative w-full max-w-lg card p-6 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">{t(label)}</h2>
              <button
                type="button"
                onClick={() => status.type !== "sending" && setOpen(false)}
                className="text-ink-faint hover:text-ink"
                aria-label={t("Close")}
              >
                <X size={18} />
              </button>
            </div>

            {status.type === "success" ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <CheckCircle2 size={40} className="text-emerald-500" />
                <p className="font-medium">{t("Email sent")}</p>
                <p className="text-sm text-ink-muted">
                  {t("The PDF was sent to {recipient}.", { recipient: status.to })}
                </p>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-2">
                  {t("Done")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {status.type === "error" && (
                  <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{t(status.message)}</span>
                  </div>
                )}

                <div>
                  <label className="label">{t("To")}</label>
                  <input
                    type="email"
                    className="input"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="customer@example.com"
                  />
                  {!toValid && to.length > 0 && (
                    <p className="mt-1 text-xs text-danger-500">{t("That doesn't look like a valid email.")}</p>
                  )}
                </div>

                {showCc && (
                  <div>
                    <label className="label">{t("CC (optional)")}</label>
                    <input
                      type="text"
                      className="input"
                      value={cc}
                      onChange={(e) => setCc(e.target.value)}
                      placeholder="cc@example.com, another@example.com"
                    />
                    {!ccValid && (
                      <p className="mt-1 text-xs text-danger-500">
                        {t("One of these doesn't look like a valid email.")}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="label">{t("PDF language")}</label>
                  <select
                    className="input"
                    value={pdfLanguage}
                    onChange={(e) => setPdfLanguage(e.target.value as PdfDownloadLanguage)}
                  >
                    <option value="EN">English</option>
                    <option value="ZH_HANT">繁體</option>
                    <option value="ZH_HANS">简体</option>
                  </select>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {t("The attached PDF is generated in this language. It does not change the saved document.")}
                  </p>
                </div>

                <div>
                  <label className="label">{t("Subject")}</label>
                  <input
                    type="text"
                    className="input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">{t("Message")}</label>
                  <textarea
                    className="input min-h-[160px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {t(
                      "The latest PDF is attached automatically, and an HR Plus signature is appended. You can also attach extra files below."
                    )}
                  </p>
                </div>

                <div>
                  <label className="label">{t("Attachments (optional)")}</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= MAX_EMAIL_ATTACHMENTS}
                    className="btn-secondary"
                  >
                    <Paperclip size={14} /> {t("Add files")}
                  </button>
                  {attachError && <p className="mt-1.5 text-xs text-danger-500">{t(attachError)}</p>}
                  {attachments.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {attachments.map((a, i) => (
                        <li
                          key={`${a.name}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-sm"
                        >
                          <span className="truncate">
                            {a.name}{" "}
                            <span className="text-ink-faint text-xs">
                              {t("({size} KB)", { size: (a.size / 1024).toFixed(0) })}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="text-ink-faint hover:text-danger-500 shrink-0"
                            aria-label={t("Remove {name}", { name: a.name })}
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {t("Up to {count} files, {size}MB each.", {
                      count: MAX_EMAIL_ATTACHMENTS,
                      size: MAX_ATTACHMENT_BYTES / (1024 * 1024),
                    })}
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={status.type === "sending"}
                    className="btn-secondary"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={status.type === "sending" || !toValid || !ccValid}
                    className="btn-primary"
                  >
                    {status.type === "sending" ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> {t("Sending…")}
                      </>
                    ) : (
                      <>
                        <Mail size={15} /> {t("Send")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
