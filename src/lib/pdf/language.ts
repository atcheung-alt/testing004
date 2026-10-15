export const PDF_DOWNLOAD_LANGUAGES = ["EN", "ZH_HANT", "ZH_HANS"] as const;
export type PdfDownloadLanguage = (typeof PDF_DOWNLOAD_LANGUAGES)[number];

export const PDF_DOWNLOAD_LANGUAGE_LABELS: Record<PdfDownloadLanguage, string> = {
  EN: "English",
  ZH_HANT: "繁體中文",
  ZH_HANS: "简体中文",
};

/** The two download buttons shown everywhere. ZH is Traditional Chinese. */
export const PDF_DOWNLOAD_BUTTONS: { lang: PdfDownloadLanguage; label: string }[] = [
  { lang: "EN", label: "Download PDF (EN)" },
  { lang: "ZH_HANT", label: "Download PDF(ZH)" },
];

/** A `lang` query value, or undefined when it isn't one of the three PDF languages. */
export function pdfDownloadLanguage(value: string | null | undefined): PdfDownloadLanguage | undefined {
  return PDF_DOWNLOAD_LANGUAGES.includes(value as PdfDownloadLanguage)
    ? (value as PdfDownloadLanguage)
    : undefined;
}

export function pdfLanguageSuffix(language?: string | null): string {
  if (language === "ZH_HANT") return "-zh-hant";
  if (language === "ZH_HANS") return "-zh-hans";
  if (language === "EN") return "-en";
  return "";
}

/** Append `lang` to a PDF URL that may already have a query string. */
export function appendPdfLanguage(url: string, language: PdfDownloadLanguage): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}lang=${language}`;
}

/** The language a staff member picked when sending a PDF, if they picked one. */
export function pdfLanguageFromBody(value: unknown): PdfDownloadLanguage | undefined {
  return typeof value === "string" ? pdfDownloadLanguage(value) : undefined;
}

export function pdfFileName(number: string, language?: string | null): string {
  return `${number}${pdfLanguageSuffix(language)}.pdf`;
}

export function pdfLanguageLabel(language?: string | null): string {
  if (language === "ZH_HANT") return "Traditional Chinese PDF";
  if (language === "ZH_HANS") return "Simplified Chinese PDF";
  return "English PDF";
}

export function pdfContentDisposition(filename: string, language?: string | null): string {
  const suffix = pdfLanguageSuffix(language);
  const named = filename.toLowerCase().endsWith(".pdf")
    ? `${filename.slice(0, -4)}${suffix}.pdf`
    : `${filename}${suffix}`;
  return `inline; filename="${named}"`;
}
