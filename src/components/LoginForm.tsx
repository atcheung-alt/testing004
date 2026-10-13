"use client";

import { useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Google sign-in isn't set up on this server yet.",
  no_code: "Google sign-in didn't complete. Please try again.",
  invalid_state: "That sign-in link expired or was already used. Please try again.",
  exchange_failed: "Couldn't verify your Google account. Please try again.",
  unverified_email: "That Google account's email isn't verified, so it can't be used to log in.",
  not_authorized:
    "That Google account isn't authorized for this app yet. Ask an admin to add your email in Settings → Staff accounts.",
  database:
    "The database is connected, but its tables are not ready yet. Reload this page after the latest deploy finishes.",
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.7 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.7 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45c5.5 0 10.5-2 14.1-5.4l-6.5-5.5C29.6 35.9 27 37 24 37c-5.1 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.5 40.6 16.2 45 24 45z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.5 5.5C41.6 35.7 45 30.4 45 24c0-1.4-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginForm({
  mode,
  next,
  googleEnabled,
  errorCode,
}: {
  mode: "setup" | "login";
  next: string;
  googleEnabled: boolean;
  errorCode?: string;
}) {
  const t = useT();
  const [error] = useState<string | null>(errorCode || null);

  function continueWithGoogle() {
    window.location.href = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">
          {mode === "setup" ? t("Set up the first account") : t("Log in")}
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          {mode === "setup"
            ? t(
                "No staff accounts exist yet — sign in with your Google Workspace account to create the first one. Add teammates afterward from Settings → Staff accounts."
              )
            : t("Sign in with your Google Workspace account to continue.")}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-500/30 text-danger-600 text-sm rounded-xl px-3 py-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{t(ERROR_MESSAGES[error] || "Something went wrong signing in.")}</span>
        </div>
      )}

      {googleEnabled ? (
        <button type="button" onClick={continueWithGoogle} className="btn-primary justify-center">
          <GoogleIcon /> {t("Continue with Google")}
        </button>
      ) : (
        <div className="flex items-start gap-2 bg-accent-100/60 border border-accent-300 text-accent-600 text-sm rounded-xl px-3 py-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            {t("Google sign-in isn't configured on this server yet. An admin needs to set")}
            <code className="mx-1 px-1 py-0.5 rounded bg-surface text-xs">GOOGLE_OAUTH_CLIENT_ID</code>
            {t("and")}
            <code className="mx-1 px-1 py-0.5 rounded bg-surface text-xs">GOOGLE_OAUTH_CLIENT_SECRET</code>
            {t("in the server's environment (see .env.example) — there's no other way to log in.")}
          </span>
        </div>
      )}
    </div>
  );
}
