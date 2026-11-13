import { JWT } from "google-auth-library";

// Least-privilege scope: the service account can only see/manage files it
// itself creates (or files explicitly shared with it), not the whole Drive.
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

// Every request below includes supportsAllDrives / includeItemsFromAllDrives.
// This is required — service accounts have no storage quota of their own,
// so uploads into a personal "My Drive" folder fail with
// `storageQuotaExceeded` no matter how the folder is shared. A Shared Drive
// (where the service account is added as a member) owns storage itself, and
// these two params are what let the API calls see/use it.
const SHARED_DRIVE_PARAMS = "supportsAllDrives=true&includeItemsFromAllDrives=true";

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function getClient(): JWT {
  if (!isDriveConfigured()) {
    throw new Error(
      "Google Drive is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (see .env.example)."
    );
  }
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const client = getClient();
  let token: string | null | undefined;
  try {
    ({ token } = await client.getAccessToken());
  } catch (err: any) {
    // Wrap google-auth-library's raw error (often a terse "invalid_grant" or
    // "error:1E08010C" from a malformed private key) with something actionable.
    throw new Error(
      `Could not authenticate with Google Drive — check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are set correctly (${
        err?.message || err
      }).`
    );
  }
  if (!token) throw new Error("Could not obtain a Google Drive access token.");
  return { Authorization: `Bearer ${token}` };
}

/**
 * List the Shared Drives the service account can currently see (i.e. has
 * been added as a member of). Used purely for diagnostics — comparing this
 * list against your configured GOOGLE_DRIVE_ROOT_FOLDER_ID is the fastest
 * way to tell "wrong ID" apart from "never actually added as a member".
 */
export async function listAccessibleSharedDrives(): Promise<{ id: string; name: string }[]> {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/drives?pageSize=50&fields=drives(id,name)`, { headers });
  if (!res.ok) {
    throw new Error(`Listing Shared Drives failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.drives || [];
}

/** Escape a value for safe interpolation into a Drive `q` search filter. */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Find a folder by exact name under `parentId` (Drive root if omitted),
 * creating it if it doesn't already exist. Reusing the existing folder is
 * what keeps every document for the same client/project in one place
 * instead of spawning a new folder on every sync.
 *
 * `parentId` must be a folder inside a Shared Drive (or a Shared Drive's own
 * ID) — see the storage-quota note above.
 */
export async function findOrCreateFolder(
  name: string,
  parentId?: string | null
): Promise<string> {
  const headers = await authHeaders();
  const parentClause = parentId
    ? `'${escapeQueryValue(parentId)}' in parents`
    : `'root' in parents`;
  const q = `name = '${escapeQueryValue(
    name
  )}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${parentClause}`;

  const listRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive&${SHARED_DRIVE_PARAMS}&corpora=allDrives`,
    { headers }
  );
  if (!listRes.ok) {
    throw new Error(`Drive folder lookup failed (${listRes.status}): ${await listRes.text()}`);
  }
  const listData = await listRes.json();
  if (listData.files?.length) return listData.files[0].id;

  const createRes = await fetch(`${DRIVE_API}/files?fields=id&${SHARED_DRIVE_PARAMS}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Drive folder creation failed (${createRes.status}): ${await createRes.text()}`);
  }
  const created = await createRes.json();
  return created.id;
}

export type UpsertedDriveFile = { id: string; webViewLink: string };

/** Remove one file this account created. A missing file is treated as already gone. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${SHARED_DRIVE_PARAMS}`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 404 || res.status === 204) return;
  if (!res.ok) {
    throw new Error(`Drive file delete failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Create or update (in place) a PDF file in Drive. Passing the previously
 * stored `fileId` overwrites that same file's content instead of creating a
 * new one — re-running this for the same document never produces duplicate
 * or stale copies, it just keeps one file current.
 *
 * `folderId` must live inside a Shared Drive — see the storage-quota note
 * above; personal "My Drive" folders will fail with storageQuotaExceeded no
 * matter how they're shared with the service account.
 */
export async function upsertDriveFile(args: {
  fileId?: string | null;
  name: string;
  folderId: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<UpsertedDriveFile> {
  const { fileId, name, folderId, buffer, mimeType = "application/pdf" } = args;
  const headers = await authHeaders();

  if (fileId) {
    const updateRes = await fetch(
      `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media&fields=id,webViewLink&${SHARED_DRIVE_PARAMS}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": mimeType },
        body: new Uint8Array(buffer),
      }
    );
    if (updateRes.ok) {
      const updated = await updateRes.json();
      // Best-effort: keep the visible filename in sync too (e.g. if a draft
      // number changed). Not worth failing the whole sync over.
      fetch(`${DRIVE_API}/files/${fileId}?fields=id&${SHARED_DRIVE_PARAMS}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).catch(() => {});
      return {
        id: updated.id,
        webViewLink: updated.webViewLink || `https://drive.google.com/file/d/${updated.id}/view`,
      };
    }
    // The previously-stored file may have been deleted/trashed directly in
    // Drive — fall through and create a fresh one instead of failing.
    const updateErrText = await updateRes.text();
    if (updateRes.status !== 404) {
      throw new Error(`Drive file update failed (${updateRes.status}): ${updateErrText}`);
    }
    console.warn(
      `Drive file ${fileId} for "${name}" was missing (404) — creating a new one instead.`
    );
  }

  // Resumable upload: first register the metadata (name + parent folder) to
  // get a one-time upload session URL, then PUT the PDF bytes to it. This is
  // more robust than hand-building a multipart/related body and is Google's
  // recommended approach.
  const initRes = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,webViewLink&${SHARED_DRIVE_PARAMS}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        "X-Upload-Content-Length": String(buffer.length),
      },
      body: JSON.stringify({ name, parents: [folderId] }),
    }
  );
  if (!initRes.ok) {
    throw new Error(`Drive upload session could not be started (${initRes.status}): ${await initRes.text()}`);
  }
  const sessionUrl = initRes.headers.get("location");
  if (!sessionUrl) {
    throw new Error("Drive did not return an upload session URL (missing Location header).");
  }

  const uploadRes = await fetch(sessionUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": mimeType, "Content-Length": String(buffer.length) },
    body: new Uint8Array(buffer),
  });
  if (!uploadRes.ok) {
    throw new Error(`Drive file upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
  }
  const created = await uploadRes.json();
  return {
    id: created.id,
    webViewLink: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
  };
}
