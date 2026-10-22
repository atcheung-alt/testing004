"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function MyNicknameForm() {
  const t = useT();
  const [nickname, setNickname] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/nickname")
      .then((res) => res.json())
      .then((data) => {
        setNickname(data.nickname || "");
        setStaffCode(data.staffCode || "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/account/nickname", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your nickname.");
      setNickname(data.nickname || "");
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-3 max-w-2xl">
      <div>
        <h2 className="font-display text-lg font-semibold">{t("Your nickname")}</h2>
        <p className="text-sm text-ink-muted mt-0.5">
          {t("Only you can change this name. Colleagues see it on the quotations and invoices you create.")}
        </p>
        {staffCode && (
          <p className="text-sm text-ink mt-2">
            {t(
              "Your staff number is {code}. Colleagues see your nickname. This number stays on our site and is not printed for clients.",
              { code: staffCode }
            )}
          </p>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-ink-muted">{t("Loading…")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            value={nickname}
            placeholder={t("e.g. AT")}
            onChange={(e) => {
              setSaved(false);
              setNickname(e.target.value);
            }}
          />
          <button type="button" className="btn-secondary" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {t("Save nickname")}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 size={15} /> {t("Saved")}
            </span>
          )}
        </div>
      )}
      {error && <p className="text-sm text-danger-600">{t(error)}</p>}
    </div>
  );
}
