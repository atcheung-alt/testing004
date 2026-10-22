import {
  Clock,
  FilePlus,
  Pencil,
  Eye,
  MessageSquare,
  PenTool,
  ArrowRightLeft,
  Wallet,
  ReceiptText,
  Mail,
  UploadCloud,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/lib/calculations";
import { getT } from "@/lib/i18n/server";
import type { TFunction } from "@/lib/i18n/translate";

const ICONS: Record<string, LucideIcon> = {
  CREATED: FilePlus,
  EDITED: Pencil,
  VIEWED: Eye,
  COMMENT_ADDED: MessageSquare,
  SIGNED: PenTool,
  INVOICE_GENERATED: ArrowRightLeft,
  PAYMENT_MARKED: Wallet,
  RECEIPT_GENERATED: ReceiptText,
  EMAIL_SENT: Mail,
  DRIVE_UPLOAD: UploadCloud,
  DELETED: Trash2,
};

const LABELS: Record<string, string> = {
  CREATED: "Created",
  EDITED: "Edited",
  VIEWED: "Viewed by client",
  COMMENT_ADDED: "Comment added",
  SIGNED: "Signed",
  INVOICE_GENERATED: "Invoice generated",
  PAYMENT_MARKED: "Payment marked",
  RECEIPT_GENERATED: "Receipt generated",
  EMAIL_SENT: "Email sent",
  DRIVE_UPLOAD: "Synced to Google Drive",
  DELETED: "Deleted",
};

// STAFF events carry the actual logged-in staff member's name — resolved
// centrally in logActivity() via the session — so show it when present,
// falling back to a generic "Staff" only for older events logged before
// that name-resolution existed. CLIENT events use whatever name the client
// actually typed (signing, comments, payment claims); SYSTEM events are
// fully automated with no individual to attribute.
function actorLabel(actor: string, actorName: string | null | undefined, t: TFunction): string {
  if (actor === "CLIENT") return actorName ? t("{name} (client)", { name: actorName }) : t("Client");
  if (actor === "SYSTEM") return t("Automatic");
  return (actorName || t("Staff")).replace(/\s+#\d{8}\b/g, "");
}

export type ActivityTimelineEvent = {
  id: string;
  type: string;
  actor: string;
  actorName: string | null;
  description: string;
  createdAt: string | Date;
};

export default function ActivityTimeline({ events }: { events: ActivityTimelineEvent[] }) {
  const t = getT();
  return (
    <div className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-4">
        {t("Activity")}
      </h2>
      {events.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("No activity recorded yet.")}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {events.map((event) => {
            const Icon = ICONS[event.type] || Clock;
            const label = t(LABELS[event.type] || event.type);
            return (
              <li key={event.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-paper flex items-center justify-center shrink-0 text-ink-muted">
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-ink">{label}</p>
                    <span className="text-xs text-ink-faint shrink-0">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {event.description || label} · {actorLabel(event.actor, event.actorName, t)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
