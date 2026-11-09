import path from "path";
import fs from "fs";
import { Font } from "@react-pdf/renderer";

// The 14 built-in PDF fonts (Helvetica, etc.) only cover Latin-1 — any CJK
// character (Chinese company names, in particular) silently renders as
// garbled/missing glyphs with them.
//
// Noto Sans SC was chosen over Noto Sans TC after hitting real garbling on
// a mainland Chinese company name: verified directly against both fonts'
// cmap tables (via fontTools) that Noto Sans TC is missing several
// Simplified-only characters (e.g. 应, 链) that have no shared codepoint
// with their Traditional form. Noto Sans SC, despite the name, covers both
// — verified against the same Simplified test data *and* an earlier
// Traditional-Chinese test batch (Hong Kong company/address/terms text) —
// full coverage on both, so one font handles both scripts here rather than
// needing per-character font-switching. It also covers standard Latin text
// fine, so it replaces Helvetica everywhere it's used.
//
// Static Regular/Bold instances, not the variable font directly: Google's
// only distributed build is a variable font whose DEFAULT instance (no
// variation coordinates applied) is Thin (wght=100), not Regular (400) —
// confirmed directly via fontTools' fvar table. Registering that file
// under fontWeight "normal"/"bold" and hoping the renderer resolves the
// right named instance produced exactly the "text is too thin" complaint
// this caused in production — variable font weight axes generally aren't
// reliably resolved through PDF embedding, which traditionally expects a
// static glyph outline per weight, not a variation to interpolate. Fixed
// by statically instantiating the exact Regular (400) and Bold (700)
// instances from the variable font with fontTools' varLib.instancer,
// producing real static TTFs with the correct weight baked into the
// glyph outlines themselves — no runtime axis resolution involved at all.
const FONT_DIR_CANDIDATES = [
  path.join(__dirname, "fonts"),
  path.join(process.cwd(), "src", "lib", "pdf", "fonts"),
  path.join(process.cwd(), ".next", "server", "src", "lib", "pdf", "fonts"),
];

function findFont(filename: string): string | undefined {
  for (const dir of FONT_DIR_CANDIDATES) {
    const candidate = path.join(dir, filename);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

const REGULAR = findFont("NotoSansSC-Regular.ttf");
const BOLD = findFont("NotoSansSC-Bold.ttf");

if (!REGULAR || !BOLD) {
  console.error(
    "[pdf] NotoSansSC static font files not found in any expected location — falling back to Helvetica (CJK text will garble, and weight will be wrong). Checked directories:",
    FONT_DIR_CANDIDATES
  );
} else {
  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: REGULAR, fontWeight: "normal" },
      { src: BOLD, fontWeight: "bold" },
    ],
  });
}

// Used everywhere instead of the literal family name, so missing font
// files degrade to the original (CJK-garbling, but functional) Helvetica
// behavior rather than breaking PDF generation entirely.
export const PDF_FONT = REGULAR && BOLD ? "NotoSansSC" : "Helvetica";
export const PDF_FONT_BOLD = REGULAR && BOLD ? "NotoSansSC" : "Helvetica-Bold";

// Disable hyphenation for genuine single "words" (so labels like
// "Pricing (HKD)" and unit strings like "HK$1,000/Location(s)" wrap at
// spaces instead of getting an ugly mid-word hyphen) — but CJK text has no
// spaces between characters at all, so react-pdf's word-splitter treats an
// entire run of Chinese/Japanese/Korean characters as a single "word" and,
// without this exception, that whole run would never be allowed to break,
// overflowing straight past its column's right edge instead of wrapping.
// Real CJK typography allows a line break between almost any two
// characters, so runs of CJK characters are split into individually
// breakable units here.
//
// A measurement run with no spaces, such as "37×1.39×1.43×1.44×1.45×1",
// is also one "word". Left unbroken it is wider than the description
// column, and that is what stops the PDF from being generated. Break only
// before each measurement sign so "×1.45" stays one piece and moves to the
// next line or page together. A short number such as "1.45" is never cut.
// A single piece that is still wider than the column is broken so the PDF
// can be placed; the break is moved off a short decimal when it can be.
const CJK_RANGES =
  /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\uAC00-\uD7A3]/;

const MEASUREMENT_SIGN = /[×✕✖*]/;

/** Pieces react-pdf is allowed to wrap between. Joining them rebuilds `word`. */
export function pdfBreakableUnits(word: string): string[] {
  if (!word) return [];
  if (!CJK_RANGES.test(word)) return fitColumn(measurementParts(word));

  const parts: string[] = [];
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    parts.push(...fitColumn(measurementParts(buffer)));
    buffer = "";
  };
  for (const char of word) {
    if (CJK_RANGES.test(char)) {
      flush();
      parts.push(char);
    } else {
      buffer += char;
    }
  }
  flush();
  return parts;
}

function measurementParts(token: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  const chars = Array.from(token);
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const prev = chars[i - 1] || "";
    const next = chars[i + 1] || "";
    const isMeasureSign =
      MEASUREMENT_SIGN.test(char) ||
      ((char === "x" || char === "X") && /\d/.test(prev) && /\d/.test(next));
    if (isMeasureSign && buffer) {
      parts.push(buffer);
      buffer = char;
    } else {
      buffer += char;
    }
  }
  if (buffer) parts.push(buffer);
  return parts;
}

// Digits at 8pt fit about 24 across the 25% description column. A longer
// unbreakable piece overflows that column and the PDF cannot be generated.
const MAX_UNBROKEN = 24;

function fitColumn(parts: string[]): string[] {
  return parts.flatMap((part) => chunksThatFit(part));
}

function chunksThatFit(token: string): string[] {
  const chars = Array.from(token);
  if (chars.length <= MAX_UNBROKEN) return [token];
  const parts: string[] = [];
  let i = 0;
  while (i < chars.length) {
    let end = Math.min(i + MAX_UNBROKEN, chars.length);
    if (end < chars.length) {
      const window = chars.slice(i, end).join("");
      const atEnd = window.match(/(\d+\.\d*)$/);
      if (atEnd && atEnd.index !== undefined && atEnd.index > 0) {
        end = i + Array.from(window.slice(0, atEnd.index)).length;
      } else if (atEnd && atEnd.index === 0) {
        const number = chars.slice(i).join("").match(/^\d+\.\d+/);
        if (number && Array.from(number[0]).length <= MAX_UNBROKEN) {
          end = i + Array.from(number[0]).length;
        }
      }
    }
    if (end <= i) end = i + 1;
    parts.push(chars.slice(i, end).join(""));
    i = end;
  }
  return parts;
}

Font.registerHyphenationCallback((word) => pdfBreakableUnits(word));
