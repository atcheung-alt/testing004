import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, Inter, IBM_Plex_Mono, Allura } from "next/font/google";
import { getEffectiveAnimationsEnabled, getEffectiveThemeModeFor } from "@/lib/appSettings";
import { getCurrentUser } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n/client";
import { htmlLang } from "@/lib/i18n/language";
import { getAppLanguage } from "@/lib/i18n/server";
import PublicLanguageSwitch from "@/components/PublicLanguageSwitch";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

// Handwriting font used for typed e-signatures — an elegant, flowing script
// (rather than a casual handwriting style) so typed signatures read as
// genuine signatures.
const allura = Allura({
  subsets: ["latin"],
  variable: "--font-signature",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resource Management System - HR Plus",
  description: "Create quotations, convert them to invoices, and export polished PDFs.",
};

// Root layout only supplies the document shell (fonts, global styles). The
// internal staff app (Sidebar/Topbar) lives in the `(app)` route group's own
// layout; the public `/sign/[token]` signing page is a sibling route outside
// that group, so it renders with this bare shell only — no staff navigation.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once per request so the very first paint already reflects the
  // saved preference — no flash of animated content before client JS can
  // react to it. See the `[data-animations="off"]` kill-switch in
  // globals.css and the toggle on the Settings page.
  const animationsEnabled = await getEffectiveAnimationsEnabled();
  // Same no-flash approach for color scheme: "light"/"dark" are resolved
  // entirely by the CSS variable blocks in globals.css keyed off this
  // attribute, and "auto" is resolved by a `prefers-color-scheme` media
  // query in that same CSS — so no client JS is needed even for "auto".
  // Resolves to the signed-in user's own theme preference if they've set
  // one, otherwise the company-wide default — see getEffectiveThemeModeFor.
  // On the login page there's no user, so this is just the company default.
  // On the public client/employee token pages (sign, invoice, leave,
  // onboarding, recruitment-sign, contract-sign) there's no user AND no
  // reason to inherit the internal dashboard's chosen theme either — those
  // visitors don't have an HR Plus account, so the middleware flags those
  // routes (see `x-theme-follow-system` in src/middleware.ts) and this
  // forces "AUTO" instead, following the visitor's own OS/browser setting.
  const user = await getCurrentUser();
  const followSystemTheme = headers().get("x-theme-follow-system") === "1";
  const themeMode = followSystemTheme ? "AUTO" : await getEffectiveThemeModeFor(user?.userId);
  const language = getAppLanguage();

  return (
    <html
      lang={htmlLang(language)}
      data-animations={animationsEnabled ? "on" : "off"}
      data-theme={themeMode.toLowerCase()}
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} ${allura.variable}`}
    >
      <body>
        <LanguageProvider language={language}>
          <PublicLanguageSwitch />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
