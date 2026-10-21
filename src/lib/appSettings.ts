import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { isValidEmail } from "@/lib/settings";

// -----------------------------------------------------------------------------
// Admin-configurable settings, persisted in the single-row `Setting` table.
// This is the ONLY place that reads/writes that table — everywhere else in
// the app should go through the helpers below (getEffectiveCompany,
// getEffectiveDriveFolderId, getEffectiveCc) rather than touching prisma or
// COMPANY directly, so the Settings page stays the single source of truth.
// -----------------------------------------------------------------------------

const SETTING_ID = "singleton";

export type ThemeMode = "LIGHT" | "DARK" | "AUTO";

const VALID_THEME_MODES: ThemeMode[] = ["LIGHT", "DARK", "AUTO"];

export function normalizeThemeMode(value: unknown): ThemeMode {
  return VALID_THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : "LIGHT";
}

export type AppSettings = {
  driveFolderId: string;
  companyName: string;
  companyLogo: string | null;
  // "Dark mode" logo — shown in the sidebar only, in place of `companyLogo`,
  // whenever the resolved theme is dark. Every PDF/email and the light-mode
  // sidebar always use `companyLogo`; this field is purely a sidebar swap
  // and has no effect anywhere else. Falls back to `companyLogo` if unset.
  companyLogoDark: string | null;
  companyWebsite: string;
  ccEnabled: boolean;
  ccEmails: string; // raw comma-separated string, as stored/edited
  animationsEnabled: boolean;
  themeMode: ThemeMode;
  mpfNotificationsEnabled: boolean;
};

const EMPTY_SETTINGS: AppSettings = {
  driveFolderId: "",
  companyName: "",
  companyLogo: null,
  companyLogoDark: null,
  companyWebsite: "",
  ccEnabled: true,
  ccEmails: (COMPANY.defaultCc || []).join(", "),
  animationsEnabled: true,
  themeMode: "LIGHT",
  mpfNotificationsEnabled: true,
};

/** Fetch the current settings row, returning sensible empty defaults if none exists yet. */
export async function getSettings(): Promise<AppSettings> {
  try {
    const row = await prisma.setting.findUnique({ where: { id: SETTING_ID } });
    if (!row) return EMPTY_SETTINGS;
    return {
      driveFolderId: row.driveFolderId || "",
      companyName: row.companyName || "",
      companyLogo: row.companyLogo || null,
      companyLogoDark: (row as any).companyLogoDark || null,
      companyWebsite: row.companyWebsite || "",
      ccEnabled: row.ccEnabled,
      ccEmails: row.ccEmails || "",
      animationsEnabled: row.animationsEnabled,
      themeMode: normalizeThemeMode((row as any).themeMode),
      mpfNotificationsEnabled: (row as any).mpfNotificationsEnabled !== false,
    };
  } catch (err) {
    // Defensive fallback: getSettings() now runs on every single page via
    // the root layout's animations toggle (getEffectiveAnimationsEnabled),
    // including Next.js's build-time static prerendering — so if this table
    // is ever missing a column that was just added to the schema but not
    // yet pushed to the live database (`npx prisma db push`), or the DB is
    // briefly unreachable, this must not take down the entire build/site.
    // Fall back to defaults instead; still logged so it's visible in
    // Vercel's build/function logs.
    console.error("getSettings() failed, falling back to defaults:", err);
    return EMPTY_SETTINGS;
  }
}

export type SettingsInput = Partial<{
  driveFolderId: string | null;
  companyName: string | null;
  companyLogo: string | null;
  companyLogoDark: string | null;
  companyWebsite: string | null;
  ccEnabled: boolean;
  ccEmails: string | null;
  animationsEnabled: boolean;
  themeMode: ThemeMode;
  mpfNotificationsEnabled: boolean;
}>;

/** Create or update the settings row. Only the fields present on `input` are changed. */
export async function updateSettings(input: SettingsInput): Promise<AppSettings> {
  const data: Record<string, unknown> = {};
  if ("driveFolderId" in input) data.driveFolderId = input.driveFolderId?.trim() || null;
  if ("companyName" in input) data.companyName = input.companyName?.trim() || null;
  if ("companyLogo" in input) data.companyLogo = input.companyLogo || null;
  if ("companyLogoDark" in input) data.companyLogoDark = input.companyLogoDark || null;
  if ("companyWebsite" in input) data.companyWebsite = input.companyWebsite?.trim() || null;
  if ("ccEnabled" in input) data.ccEnabled = input.ccEnabled;
  if ("ccEmails" in input) data.ccEmails = (input.ccEmails || "").trim();
  if ("animationsEnabled" in input) data.animationsEnabled = input.animationsEnabled;
  if ("themeMode" in input) data.themeMode = normalizeThemeMode(input.themeMode);
  if ("mpfNotificationsEnabled" in input) data.mpfNotificationsEnabled = input.mpfNotificationsEnabled;

  const row = await prisma.setting.upsert({
    where: { id: SETTING_ID },
    create: { id: SETTING_ID, ...data },
    update: data,
  });

  return {
    driveFolderId: row.driveFolderId || "",
    companyName: row.companyName || "",
    companyLogo: row.companyLogo || null,
    companyLogoDark: (row as any).companyLogoDark || null,
    companyWebsite: row.companyWebsite || "",
    ccEnabled: row.ccEnabled,
    ccEmails: row.ccEmails || "",
    animationsEnabled: row.animationsEnabled,
    themeMode: normalizeThemeMode((row as any).themeMode),
    mpfNotificationsEnabled: (row as any).mpfNotificationsEnabled !== false,
  };
}

/** Split a comma/newline-separated CC field into a de-duplicated list of valid addresses. */
export function parseCcEmails(raw: string): string[] {
  return raw
    .split(/[,\n;]/)
    .map((e) => e.trim())
    .filter((e, i, arr) => e && isValidEmail(e) && arr.indexOf(e) === i);
}

/**
 * The company info the rest of the app should render — COMPANY's static
 * defaults (currency, banking, contact, chop, etc.) with name/logo/website
 * overridden by whatever's configured on the Settings page, if anything.
 */
export async function getEffectiveCompany(): Promise<
  typeof COMPANY & { logoDataDark: string | null }
> {
  const settings = await getSettings();
  return {
    ...COMPANY,
    name: settings.companyName || COMPANY.name,
    shortName: settings.companyName || COMPANY.shortName,
    logoData: settings.companyLogo || COMPANY.logoData,
    // Sidebar-only (and now every public-page header) dark-mode swap — see
    // CompanyLogo.tsx. Deliberately has no COMPANY fallback: there's no
    // static default dark logo, so this is null unless an admin uploads
    // one, in which case the primary logo just keeps showing in dark mode.
    logoDataDark: settings.companyLogoDark || null,
    website: settings.companyWebsite || COMPANY.website,
  };
}

/**
 * The Google Drive parent folder ID to sync generated PDFs into — the
 * Settings page value if set, otherwise the GOOGLE_DRIVE_ROOT_FOLDER_ID env
 * var (kept as a fallback for existing deployments that configured it there).
 */
export async function getEffectiveDriveFolderId(): Promise<string | null> {
  const settings = await getSettings();
  return settings.driveFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
}

/**
 * The standing CC list to apply to every outgoing document/notification
 * email — empty when CC'ing is turned off on the Settings page.
 */
export async function getEffectiveCc(): Promise<string[]> {
  const settings = await getSettings();
  if (!settings.ccEnabled) return [];
  return parseCcEmails(settings.ccEmails);
}

/**
 * Whether UI animations (hover/press effects, page transitions, modal
 * entrances) should be active. Read in the root layout and stamped onto
 * `<html data-animations="on|off">` so it applies from first paint, before
 * any client JS runs — see the kill-switch rule in globals.css.
 */
export async function getEffectiveAnimationsEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.animationsEnabled;
}

/**
 * The site-wide color scheme preference ("LIGHT", "DARK", or "AUTO"). Read
 * in the root layout and stamped onto `<html data-theme="light|dark|auto">`
 * so the very first paint already reflects it — see the CSS variable blocks
 * in globals.css, which resolve "auto" via a `prefers-color-scheme` media
 * query with no client JS required.
 */
export async function getEffectiveThemeMode(): Promise<ThemeMode> {
  const settings = await getSettings();
  return settings.themeMode;
}

/**
 * A signed-in user's personal theme override, if they've set one on their
 * own account — null means they haven't, i.e. they defer to the company-
 * wide default above. Kept out of the signed session cookie deliberately
 * (see the comment on User.themeMode) so a change takes effect on the very
 * next page load rather than waiting for the next sign-in.
 */
export async function getUserThemeMode(userId: string): Promise<ThemeMode | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { themeMode: true } });
    const raw = (user as any)?.themeMode;
    return raw && VALID_THEME_MODES.includes(raw) ? (raw as ThemeMode) : null;
  } catch (err) {
    console.error("getUserThemeMode() failed, falling back to no personal override:", err);
    return null;
  }
}

/**
 * The color scheme that should actually render for this request: the
 * signed-in user's personal override if they've set one, otherwise the
 * company-wide default. Read in the root layout so `<html data-theme>`
 * reflects whichever one applies from first paint, before any client JS
 * runs — same no-flash approach as getEffectiveThemeMode/
 * getEffectiveAnimationsEnabled above.
 */
export async function getEffectiveThemeModeFor(userId: string | null | undefined): Promise<ThemeMode> {
  if (userId) {
    const personal = await getUserThemeMode(userId);
    if (personal) return personal;
  }
  return getEffectiveThemeMode();
}

/**
 * The handful of Settings fields the app can't really function properly
 * without (branding on documents/emails, Drive sync, CC list). Checked by
 * the admin-only setup gate in the root layout — see
 * `src/components/RequiredSetupGate.tsx`.
 */
export const REQUIRED_SETTINGS_FIELDS: { key: keyof AppSettings; label: string }[] = [
  { key: "companyName", label: "Company name" },
  { key: "companyLogo", label: "Company logo" },
  { key: "companyWebsite", label: "Company website" },
  { key: "driveFolderId", label: "Google Drive folder ID" },
  { key: "ccEmails", label: "CC email address" },
];

/** Returns the human-readable labels of any required settings that are still empty. */
export function getMissingRequiredSettings(settings: AppSettings): string[] {
  return REQUIRED_SETTINGS_FIELDS.filter(({ key }) => {
    const value = settings[key];
    return typeof value === "string" ? value.trim() === "" : !value;
  }).map(({ label }) => label);
}

/** Loose shape-check for a Google Drive folder ID — just enough to catch an
 *  obviously wrong paste (a full URL, a stray space, a couple of stray
 *  characters), not a guarantee the folder actually exists. */
const DRIVE_FOLDER_ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

/**
 * Validates a fully-resolved settings object against the same required-field
 * list as `getMissingRequiredSettings`, plus format checks (website scheme,
 * Drive folder ID shape, CC address validity). Used by `PUT /api/settings`
 * so a save is rejected — not just silently accepted with gaps — whenever
 * something the rest of the app depends on is missing or malformed.
 */
export function validateSettings(settings: AppSettings): string[] {
  const errors: string[] = [];

  if (!settings.companyName.trim()) errors.push("Company name is required.");
  if (!settings.companyLogo) errors.push("Company logo is required.");

  const website = settings.companyWebsite.trim();
  if (!website) {
    errors.push("Company website is required.");
  } else if (!/^https?:\/\/.+/i.test(website)) {
    errors.push("Company website should start with http:// or https://.");
  }

  const driveFolderId = settings.driveFolderId.trim();
  if (!driveFolderId) {
    errors.push("Google Drive folder ID is required.");
  } else if (!DRIVE_FOLDER_ID_PATTERN.test(driveFolderId)) {
    errors.push(
      "Google Drive folder ID doesn't look valid — paste just the ID from the folder's URL, not the full link."
    );
  }

  const rawCc = settings.ccEmails.trim();
  if (!rawCc) {
    errors.push("At least one CC email address is required.");
  } else {
    const validCc = parseCcEmails(rawCc);
    const rawCcCount = rawCc.split(/[,\n;]/).map((e) => e.trim()).filter(Boolean).length;
    if (validCc.length < rawCcCount) errors.push("One or more CC addresses aren't valid email addresses.");
  }

  return errors;
}
