import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, SURVEY_LANGUAGE_COOKIE, parseAppLanguage, parseSurveyLanguage, type AppLanguage } from "@/lib/i18n/language";
import { makeT, type TFunction } from "@/lib/i18n/translate";

export function getAppLanguage(): AppLanguage {
  return parseAppLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
}

export function getSurveyLanguage(): AppLanguage {
  return parseSurveyLanguage(cookies().get(SURVEY_LANGUAGE_COOKIE)?.value);
}

export function getT(): TFunction {
  return makeT(getAppLanguage());
}
