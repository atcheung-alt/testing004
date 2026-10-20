/** UI language. Stored in a cookie only — nothing is written to the database. */
export const LANGUAGE_COOKIE = "hrplus-lang";
/** Guest survey only. Missing cookie means Chinese, not the staff default. */
export const SURVEY_LANGUAGE_COOKIE = "hrplus-survey-lang";

export const APP_LANGUAGES = ["en", "zh"] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

export function parseAppLanguage(value: string | null | undefined): AppLanguage {
  return value === "zh" ? "zh" : "en";
}

/** The massage QR form opens in Chinese until a guest picks English. */
export function parseSurveyLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "zh";
}

/** Chinese in this app is Traditional Chinese, matching the existing PDF "ZH" download. */
export function appLanguageToPdf(language: AppLanguage): "EN" | "ZH_HANT" {
  return language === "zh" ? "ZH_HANT" : "EN";
}

export function htmlLang(language: AppLanguage): string {
  return language === "zh" ? "zh-Hant" : "en";
}
