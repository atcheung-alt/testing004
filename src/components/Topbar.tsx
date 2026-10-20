"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function Topbar({ userName }: { userName: string }) {
  const t = useT();
  return (
    <header className="h-16 border-b border-line bg-surface flex items-center justify-end lg:justify-between px-4 sm:px-6 lg:px-10">
      <span className="hidden lg:block text-sm text-ink-muted">
        {t("Resource Management System")}
      </span>
      <div className="flex items-center gap-2 pl-12 lg:pl-0">
        <Link href="/quotations/new" className="btn-secondary">
          <Plus size={15} /> {t("New Quotation")}
        </Link>
        <Link href="/invoices/new" className="btn-primary">
          <Plus size={15} /> {t("New Invoice")}
        </Link>
        <div className="hidden sm:flex items-center ml-2 pl-2 border-l border-line">
          <span className="text-sm text-ink-muted truncate max-w-[160px]">{userName}</span>
        </div>
      </div>
    </header>
  );
}
