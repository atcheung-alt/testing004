"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2, Save, Sun, Moon, Monitor } from "lucide-react";
import clsx from "clsx";
import CompanyLogoUpload from "@/components/CompanyLogoUpload";
import ThemeModeControl from "@/components/ThemeModeControl";
import type { AppSettings, ThemeMode } from "@/types";
import { useT } from "@/lib/i18n/client";

const emptySettings: AppSettings = {
  driveFolderId: "",
  companyName: "",
  companyLogo: null,
  companyWebsite: "",
  ccEnabled: true,
  ccEmails: "",
  animationsEnabled: true,
  themeMode: "LIGHT",
  companyLogoDark: null,
  mpfNotificationsEnabled: true,
};

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "LIGHT", label: "Light mode", icon: Sun },
  { value: "DARK", label: "Dark mode", icon: Moon },
  { value: "AUTO", label: "Automatic", icon: Monitor },
];

function ThemeModeToggle({ value, onChange }: { value: ThemeMode; onChange: (v: ThemeMode) => void }) {
  const t = useT();
  return (
    <div className="inline-flex flex-wrap rounded-full border border-line bg-paper p-1 gap-1 self-start">
      {THEME_OPTIONS.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={clsx(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
            value === v ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          )}
        >
          <Icon size={15} />
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        checked ? "bg-brand-600" : "bg-line"
      )}
    >
      <span
        className={clsx(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export default function SettingsForm() {
  const t = useT();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        setSettings({ ...emptySettings, ...data });
        // Note: deliberately NOT touching document.documentElement's
        // data-theme attribute here. The root layout already stamps the
        // correct EFFECTIVE theme on <html> server-side via
        // getEffectiveThemeModeFor(), which prefers a signed-in user's
        // personal override (see ThemeModeControl.tsx / /api/account/theme)
        // over this company-wide default. Forcing it to the raw company
        // default fetched here — regardless of any personal override — was
        // exactly what made the page visibly flip from a user's chosen Dark
        // mode to the company's Light default every time Settings loaded.
        // Only `update()` below should touch this attribute, since that's
        // an explicit, in-context live-preview of the admin actively
        // editing the company default itself.
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSaved(false);
    setSettings((s) => ({ ...s, [key]: value }));
    // Live-preview the animation toggle immediately, before Save is even
    // clicked — the root layout re-reads the persisted value on next full
    // page load, but this makes the switch itself feel instant.
    if (key === "animationsEnabled" && typeof document !== "undefined") {
      document.documentElement.dataset.animations = value ? "on" : "off";
    }
    // Same live-preview trick for the color theme — the CSS that resolves
    // light/dark/auto (see globals.css) keys entirely off this attribute,
    // so flipping it here previews the change instantly, before Save.
    if (key === "themeMode" && typeof document !== "undefined") {
      document.documentElement.dataset.theme = (value as string).toLowerCase();
    }
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        // The API validates every required field is present and well-formed
        // before saving — `data.errors` lists every problem at once (not
        // just the first) so nothing needs a second round trip to surface.
        setErrors(Array.isArray(data.errors) && data.errors.length ? data.errors : [data.error || "Could not save settings."]);
        return;
      }
      setSettings({ ...emptySettings, ...data });
      setSaved(true);
      // Settings feeds the admin-only "finish setup" gate in the root
      // layout (see RequiredSetupGate) — refresh so it re-evaluates
      // immediately with the just-saved values instead of only updating
      // after the next full login/page load.
      router.refresh();
    } catch (err: any) {
      setErrors([err.message || "Could not save settings."]);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-muted">{t("Loading…")}</p>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {errors.length > 0 && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {errors.length === 1 ? (
            <span>{t(errors[0])}</span>
          ) : (
            <ul className="list-disc pl-4 flex flex-col gap-0.5">
              {errors.map((e, i) => (
                <li key={i}>{t(e)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Appearance */}
      <div className="card p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Appearance")}</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {t(
              "Hover effects, page transitions, and other motion across the whole app. Turn off for a fully static, instant-feeling interface."
            )}
          </p>
        </div>
        <label className="flex items-center justify-between gap-3 text-sm font-medium max-w-sm">
          <span>{t("Enable animations")}</span>
          <Switch
            checked={settings.animationsEnabled}
            onChange={(v) => update("animationsEnabled", v)}
          />
        </label>

        <div className="pt-3 border-t border-line flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 text-sm font-medium max-w-sm">
            <span>{t("MPF notifications")}</span>
            <Switch
              checked={settings.mpfNotificationsEnabled}
              onChange={(v) => update("mpfNotificationsEnabled", v)}
            />
          </label>
          <p className="text-xs text-ink-faint max-w-lg">
            {t(
              "When this is on, opening HR pops up a reminder for every full-time employee whose MPF enrollment deadline is 10 days away or sooner."
            )}
          </p>
        </div>

        <div className="pt-1">
          <p className="text-sm font-medium mb-2">{t("Default color theme")}</p>
          <ThemeModeToggle value={settings.themeMode} onChange={(v) => update("themeMode", v)} />
          <p className="mt-1.5 text-xs text-ink-faint">
            {t(
              "Used on the sign-in page and for any staff member who hasn't set their own theme below. \"Automatic\" follows the visitor's own device setting."
            )}
          </p>
        </div>

        <div className="pt-3 border-t border-line">
          <p className="text-sm font-medium mb-2">{t("Your theme")}</p>
          <ThemeModeControl />
          <p className="mt-1.5 text-xs text-ink-faint">
            {t(
              "Just for your account — overrides the default above whenever you're signed in, on any device."
            )}
          </p>
        </div>
      </div>

      {/* Company branding */}
      <div className="card p-5 flex flex-col gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Company Branding")}</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {t("Shown on every exported PDF and outgoing email.")}
          </p>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div>
            <p className="label">{t("Company logo (primary)")}</p>
            <CompanyLogoUpload
              imageData={settings.companyLogo}
              onChange={(data) => update("companyLogo", data)}
              label={t("primary company logo")}
            />
            <p className="mt-1 text-xs text-ink-faint w-32">
              {t("Used on every PDF/email, and in the sidebar for light mode.")}
            </p>
          </div>
          <div>
            <p className="label">{t("Company logo (dark mode)")}</p>
            <CompanyLogoUpload
              imageData={settings.companyLogoDark}
              onChange={(data) => update("companyLogoDark", data)}
              label={t("dark mode company logo")}
            />
            <p className="mt-1 text-xs text-ink-faint w-32">
              {t("Sidebar only, shown when dark mode is active. Leave blank to reuse the primary logo.")}
            </p>
          </div>
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div>
              <label className="label">{t("Company name")}</label>
              <input
                type="text"
                className="input"
                placeholder={t("e.g. HR Plus (Talent) Limited")}
                value={settings.companyName}
                onChange={(e) => update("companyName", e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("Company website")}</label>
              <input
                type="text"
                className="input"
                placeholder="https://example.com"
                value={settings.companyWebsite}
                onChange={(e) => update("companyWebsite", e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-faint">
                {t("Shown at the bottom of every outgoing email.")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Drive */}
      <div className="card p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Google Drive Sync")}</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {t(
              "The Shared Drive (or folder inside one) that generated quotation, invoice, and receipt PDFs are automatically synced into."
            )}
          </p>
        </div>
        <div>
          <label className="label">{t("Drive folder ID")}</label>
          <input
            type="text"
            className="input font-mono text-sm"
            placeholder={t("e.g. 1AbCDefGhIJklmNoPQRstuVWxyZ")}
            value={settings.driveFolderId}
            onChange={(e) => update("driveFolderId", e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-faint">
            {t("The part of the Drive folder's URL after")} <code>/folders/</code>
            {t(
              ". Must be a Shared Drive (or a folder inside one) the service account has been added to as a Member — visit"
            )}{" "}
            <code>/api/drive-test</code> {t("to verify.")}
          </p>
        </div>
      </div>

      {/* Email CC */}
      <div className="card p-5 flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("Email CC")}</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {t("Standing CC recipients added to every outgoing quotation, invoice, and notification email.")}
          </p>
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium">
          <input
            type="checkbox"
            className="w-4 h-4 accent-brand-600"
            checked={settings.ccEnabled}
            onChange={(e) => update("ccEnabled", e.target.checked)}
          />
          {t("CC these addresses on every outgoing email")}
        </label>

        <div>
          <label className="label">{t("CC addresses")}</label>
          <textarea
            className="input min-h-[80px]"
            placeholder={t("e.g. boss@example.com, manager@example.com")}
            value={settings.ccEmails}
            disabled={!settings.ccEnabled}
            onChange={(e) => update("ccEmails", e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-faint">
            {t("Separate multiple addresses with commas or new lines.")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {t("Saving…")}
            </>
          ) : (
            <>
              <Save size={15} /> {t("Save settings")}
            </>
          )}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> {t("Saved")}
          </span>
        )}
      </div>
    </div>
  );
}
