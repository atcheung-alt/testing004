"use client";

import { Download } from "lucide-react";
import { appendPdfLanguage, type PdfDownloadLanguage } from "@/lib/pdf/language";
import { useT } from "@/lib/i18n/client";

const CHOICES: { lang: PdfDownloadLanguage; label: string }[] = [
  { lang: "EN", label: "English" },
  { lang: "ZH_HANT", label: "中文" },
];

/** Download this document as an English PDF or a Traditional Chinese PDF.
 *  The choice is for this file only and is not saved on the record. */
export default function DownloadPdfButton({ url }: { url: string }) {
  const t = useT();
  return (
    <div className="inline-flex items-stretch rounded-md border border-line bg-surface overflow-hidden text-sm shrink-0">
      <span className="inline-flex items-center gap-1.5 px-3 text-ink-muted">
        <Download size={14} />
        {t("PDF")}
      </span>
      {CHOICES.map((choice) => (
        <a
          key={choice.lang}
          href={appendPdfLanguage(url, choice.lang)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-3 py-2 font-medium text-ink hover:bg-brand-50 border-l border-line transition-colors"
        >
          {choice.label}
        </a>
      ))}
    </div>
  );
}
