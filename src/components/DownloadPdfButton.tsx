"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { appendPdfLanguage, type PdfDownloadLanguage } from "@/lib/pdf/language";
import { useT } from "@/lib/i18n/client";

const CHOICES: { lang: PdfDownloadLanguage; label: string }[] = [
  { lang: "EN", label: "English" },
  { lang: "ZH_HANT", label: "繁體" },
  { lang: "ZH_HANS", label: "简体" },
];

/** Download this document as an English, Traditional Chinese, or Simplified Chinese PDF.
 *  The choice is for this file only and is not saved on the record. */
export default function DownloadPdfButton({ url }: { url: string }) {
  const t = useT();
  const [lang, setLang] = useState<PdfDownloadLanguage>("EN");

  return (
    <div className="inline-flex items-stretch rounded-md border border-line bg-surface overflow-hidden text-sm shrink-0">
      <select
        className="bg-surface px-2 py-2 text-sm text-ink outline-none cursor-pointer"
        value={lang}
        aria-label={t("PDF language")}
        onChange={(e) => setLang(e.target.value as PdfDownloadLanguage)}
      >
        {CHOICES.map((choice) => (
          <option key={choice.lang} value={choice.lang}>
            {choice.label}
          </option>
        ))}
      </select>
      <a
        href={appendPdfLanguage(url, lang)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 font-medium text-ink hover:bg-brand-50 border-l border-line transition-colors"
      >
        <Download size={14} />
        {t("Download PDF")}
      </a>
    </div>
  );
}
