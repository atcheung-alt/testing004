"use client";

import { useRef, useState } from "react";
import { Pen, Upload, Type, Trash2, Check } from "lucide-react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { typedSignatureToDataUrl } from "@/lib/signatureImage";
import { useT } from "@/lib/i18n/client";

type Mode = "draw" | "upload" | "type";

type Props = {
  /** Current stored signature (PNG data URL) or null. */
  value?: string | null;
  /** Optional typed name shown beneath the signature. */
  name?: string | null;
  onChange: (signatureData: string | null, signatureName: string | null) => void;
};

export default function SignaturePad({ value, name, onChange }: Props) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("draw");
  const [typedName, setTypedName] = useState(name || "");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string, typedName || null);
    reader.readAsDataURL(file);
  }

  function applyTyped(text: string) {
    setTypedName(text);
    onChange(typedSignatureToDataUrl(text), text || null);
  }

  const tabs: { id: Mode; label: string; icon: typeof Pen }[] = [
    { id: "draw", label: "Draw", icon: Pen },
    { id: "upload", label: "Upload", icon: Upload },
    { id: "type", label: "Type", icon: Type },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex rounded-full border border-line bg-white p-0.5 self-start">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-brand-500 text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={13} /> {t(tab.label)}
            </button>
          );
        })}
      </div>

      {mode === "draw" && (
        <SignatureCanvas onCommit={(dataUrl) => onChange(dataUrl, typedName || null)} />
      )}

      {mode === "upload" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-line bg-white py-8 flex flex-col items-center gap-2 text-ink-muted hover:text-brand-600 hover:border-brand-500/60 transition-colors"
          >
            <Upload size={20} />
            <span className="text-sm">{t("Click to upload a signature image")}</span>
            <span className="text-xs text-ink-faint">{t("PNG or JPEG, transparent background works best")}</span>
          </button>
        </div>
      )}

      {mode === "type" && (
        <div>
          <input
            type="text"
            className="input"
            placeholder={t("Type your full name")}
            value={typedName}
            onChange={(e) => applyTyped(e.target.value)}
          />
          {typedName.trim() && (
            <div className="mt-2 rounded-xl border border-line bg-white px-4 py-3">
              <span className="font-signature text-4xl text-brand-900 leading-none">
                {typedName}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Current signature preview */}
      {value ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700 mb-2">
            <Check size={14} /> {t("Signature captured")}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={t("Signature")}
            className="max-h-24 bg-white rounded-lg border border-line"
          />
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="btn-ghost mt-2 !px-2 text-xs text-danger-500 hover:text-danger-600"
          >
            <Trash2 size={13} /> {t("Remove signature")}
          </button>
        </div>
      ) : (
        <p className="text-xs text-ink-faint">{t("No signature captured yet.")}</p>
      )}

      <div>
        <label className="label">{t("Signatory name (optional)")}</label>
        <input
          type="text"
          className="input"
          placeholder={t("Name shown beneath the signature on the PDF")}
          value={typedName}
          onChange={(e) => {
            setTypedName(e.target.value);
            onChange(value ?? null, e.target.value || null);
          }}
        />
      </div>
    </div>
  );
}
