"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Read an image file, downscale it to max 480px and return a JPEG data URL. */
export function fileToResizedDataUrl(file: File, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("The selected file is not a valid image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not process the image."));
        ctx.fillStyle = "#FFFFFF"; // flatten transparency for JPEG
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ItemImageUpload({
  imageData,
  onChange,
}: {
  imageData?: string | null;
  onChange: (data: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const [over, setOver] = useState(false);

  async function useFile(file: File | undefined) {
    if (!file) return;
    try {
      onChange(await fileToResizedDataUrl(file));
    } catch {
      // silently ignore invalid files
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    await useFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setOver(true);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    void useFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      {imageData ? (
        <div className="relative w-16 h-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageData}
            alt={t("Item")}
            className={`w-16 h-16 object-cover rounded-md border cursor-pointer ${over ? "border-brand-500" : "border-line"}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={onDragOver}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            title={t("Click to replace image")}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("Remove image")}
            className="absolute -top-1.5 -right-1.5 bg-white border border-line rounded-full p-0.5 text-ink-faint hover:text-danger-500 shadow-sm"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={t("Upload item image")}
          title={t("Upload item image")}
          className={`w-16 h-16 flex flex-col items-center justify-center gap-0.5 rounded-md border border-dashed text-ink-faint hover:text-brand-600 hover:border-brand-500/60 transition-colors ${over ? "border-brand-500 text-brand-600" : "border-line"}`}
          onDragOver={onDragOver}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <ImagePlus size={18} />
          <span className="text-[10px] leading-none">{t("Image")}</span>
        </button>
      )}
    </div>
  );
}
