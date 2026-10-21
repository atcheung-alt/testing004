import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type ActivityDocumentType =
  | "quotation"
  | "invoice"
  | "recruitment"
  | "employee"
  | "payroll"
  | "booking";
export type ActivityActor = "STAFF" | "CLIENT" | "SYSTEM";

export type ActivityEventType =
  | "CREATED"
  | "EDITED"
  | "VIEWED"
  | "COMMENT_ADDED"
  | "SIGNED"
  | "INVOICE_GENERATED"
  | "PAYMENT_MARKED"
  | "RECEIPT_GENERATED"
  | "EMAIL_SENT"
  | "DRIVE_UPLOAD"
  | "DELETED"
  | "ONBOARDING_SUBMITTED"
  | "CONTRACT_VERIFIED";

/**
 * Record one activity-timeline event for a quotation or invoice.
 *
 * For STAFF-actor events, the logged-in staff member's name (from
 * Settings → Staff accounts, via the current session) is filled in
 * automatically unless the caller already passed an explicit `actorName` —
 * so every route that logs a plain "STAFF" action doesn't need to look up
 * and thread the current user through by hand. CLIENT and SYSTEM events are
 * untouched: CLIENT always carries whatever name the client actually typed
 * in (signing, comments, payment claims), and SYSTEM events are genuinely
 * automated with no individual attributable.
 *
 * Best-effort throughout: logging failures are swallowed so they never
 * break the primary action that triggered them — a missed timeline entry
 * is far less harmful than a failed save/email/etc.
 */
export async function logActivity(params: {
  documentType: ActivityDocumentType;
  documentId: string;
  type: ActivityEventType;
  actor?: ActivityActor;
  actorName?: string | null;
  description?: string;
}): Promise<void> {
  try {
    const actor = params.actor || "STAFF";
    let actorName = params.actorName || null;
    if (actor === "STAFF" && !actorName) {
      try {
        const user = await getCurrentUser();
        const email = user?.email?.trim();
        const name = user?.name?.trim();
        actorName = email ? (name && name.toLowerCase() !== email.toLowerCase() ? `${name} <${email}>` : email) : name || null;
      } catch {
        // No request/session context available (shouldn't normally happen
        // for a STAFF-actor event) — fall back to no name rather than fail.
      }
    }

    await prisma.activityEvent.create({
      data: {
        documentType: params.documentType,
        documentId: params.documentId,
        type: params.type,
        actor,
        actorName,
        description: params.description || "",
      },
    });
  } catch (err) {
    console.error("[activity] failed to log event", params.type, params.documentId, err);
  }
}

/**
 * Log a "viewed by client" event — but skip it if the most recent event on
 * this document is already a VIEWED one from within the last 30 minutes.
 * Public document pages get fetched multiple times per real visit (page
 * render + metadata generation, refreshes, etc.); without this the timeline
 * would fill up with near-duplicate entries for a single visit.
 */
export async function logClientView(
  documentType: ActivityDocumentType,
  documentId: string
): Promise<void> {
  try {
    const last = await prisma.activityEvent.findFirst({
      where: { documentType, documentId },
      orderBy: { createdAt: "desc" },
    });
    const dedupeWindowMs = 30 * 60 * 1000;
    if (last && last.type === "VIEWED" && Date.now() - last.createdAt.getTime() < dedupeWindowMs) {
      return;
    }
    await logActivity({
      documentType,
      documentId,
      type: "VIEWED",
      actor: "CLIENT",
      description: "Viewed the document online",
    });
  } catch (err) {
    console.error("[activity] failed to log client view", documentId, err);
  }
}

export async function getActivityTimeline(documentType: ActivityDocumentType, documentId: string) {
  return prisma.activityEvent.findMany({
    where: { documentType, documentId },
    orderBy: { createdAt: "asc" },
  });
}
