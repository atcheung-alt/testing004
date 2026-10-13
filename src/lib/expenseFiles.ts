const MAX_EXPENSE_FILES = 5;
const MAX_EXPENSE_FILE_BYTES = 8 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ExpenseFileInput = {
  fileName: string;
  mimeType: string;
  data: string;
};

/** Turn an uploaded data URL into the fields stored on ExpenseDocument.
 *  Throws a plain Error whose message is safe to show in the UI. */
export function expenseFilesFrom(value: unknown): ExpenseFileInput[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("Documents must be a list of files.");
  }
  if (value.length > MAX_EXPENSE_FILES) {
    throw new Error(`You can attach up to ${MAX_EXPENSE_FILES} files to one expense.`);
  }

  return value.map((raw) => {
    const fileName = typeof raw?.fileName === "string" ? raw.fileName.trim() : "";
    const data = typeof raw?.data === "string" ? raw.data.trim() : "";
    if (!fileName || !data.startsWith("data:")) {
      throw new Error("One of the files could not be read.");
    }
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(data);
    if (!match) {
      throw new Error(`"${fileName}" is not a supported file.`);
    }
    const mimeType = match[1].toLowerCase();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new Error(`"${fileName}" must be a PDF or an image.`);
    }
    const bytes = Math.floor((match[2].replace(/\s/g, "").length * 3) / 4);
    if (bytes > MAX_EXPENSE_FILE_BYTES) {
      throw new Error(`"${fileName}" is larger than ${MAX_EXPENSE_FILE_BYTES / (1024 * 1024)}MB.`);
    }
    return { fileName: fileName.slice(0, 180), mimeType, data };
  });
}

export function expenseFileBytes(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Buffer.from(base64, "base64");
}

export { MAX_EXPENSE_FILES, MAX_EXPENSE_FILE_BYTES };
