import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings, validateSettings, type AppSettings, type ThemeMode } from "@/lib/appSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  if (body.themeMode !== undefined && !["LIGHT", "DARK", "AUTO"].includes(body.themeMode)) {
    return NextResponse.json({ error: "Invalid theme mode." }, { status: 400 });
  }

  // Validate the fully-resolved settings (current row + whatever this
  // request is changing) rather than just the raw request body, so a
  // partial save can't accidentally leave a required field blank just
  // because this particular request didn't happen to include it.
  const current = await getSettings();
  const merged: AppSettings = {
    driveFolderId: typeof body.driveFolderId === "string" ? body.driveFolderId : current.driveFolderId,
    companyName: typeof body.companyName === "string" ? body.companyName : current.companyName,
    companyLogo: body.companyLogo !== undefined ? body.companyLogo : current.companyLogo,
    companyLogoDark: body.companyLogoDark !== undefined ? body.companyLogoDark : current.companyLogoDark,
    companyWebsite: typeof body.companyWebsite === "string" ? body.companyWebsite : current.companyWebsite,
    ccEnabled: typeof body.ccEnabled === "boolean" ? body.ccEnabled : current.ccEnabled,
    ccEmails: typeof body.ccEmails === "string" ? body.ccEmails : current.ccEmails,
    animationsEnabled:
      typeof body.animationsEnabled === "boolean" ? body.animationsEnabled : current.animationsEnabled,
    themeMode: typeof body.themeMode === "string" ? (body.themeMode as ThemeMode) : current.themeMode,
  };

  const errors = validateSettings(merged);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors }, { status: 400 });
  }

  const settings = await updateSettings({
    driveFolderId: merged.driveFolderId,
    companyName: merged.companyName,
    companyLogo: merged.companyLogo,
    companyLogoDark: merged.companyLogoDark,
    companyWebsite: merged.companyWebsite,
    ccEnabled: merged.ccEnabled,
    ccEmails: merged.ccEmails,
    animationsEnabled: merged.animationsEnabled,
    themeMode: merged.themeMode,
  });

  return NextResponse.json(settings);
}
