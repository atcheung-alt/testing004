"use client";

import { useEffect, useState } from "react";
import { Pen, Type, Check } from "lucide-react";
import SignatureCanvas from "@/components/SignatureCanvas";
import { typedSignatureToDataUrl } from "@/lib/signatureImage";
import { useT } from "@/lib/i18n/client";

type Mode = "draw" | "type";

type Props = {
  /** Full name from the form above — used to render the typed signature. */
  fullName: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

/**
 * Signature capture for the public signing page: draw with mouse/touch, or
 * have the typed full name rendered in a handwriting font. Deliberately
 * simpler than the staff-facing SignaturePad (no image upload) — this is a
 * client acceptance signature, not a scanned company stamp.
 */
export default function PublicSignaturePad({ fullName, value, onChange }: Props) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("draw");

  // Keep the typed signature in sync with the name field while in Type mode.
  useEffect(() => {
    if (mode !== "type") return;
    onChange(fullName.trim() ? typedSignatureToDataUrl(fullName.trim()) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fullName]);

  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex rounded-full border border-line bg-white p-0.5 self-start">
        {(
          [
            { id: "draw" as const, label: "Draw", icon: Pen },
            { id: "type" as const, label: "Type", icon: Type },
          ]
        ).map((option) => {
          const Icon = option.icon;
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setMode(option.id);
                onChange(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-brand-500 text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon size={13} /> {t(option.label)}
            </button>
          );
        })}
      </div>

      {mode === "draw" && <SignatureCanvas onCommit={onChange} />}

      {mode === "type" && (
        <div className="rounded-xl border border-line bg-white px-4 py-6 flex items-center justify-center min-h-[100px]">
          {fullName.trim() ? (
            <span className="font-signature text-4xl sm:text-5xl text-brand-900 leading-none">
              {fullName}
            </span>
          ) : (
            <span className="text-sm text-ink-faint">
              {t("Enter your full name above to preview your signature")}
            </span>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
          <Check size={14} /> {t("Signature ready")}
        </div>
      )}
    </div>
  );
}
