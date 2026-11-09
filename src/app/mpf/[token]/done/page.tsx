import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";
import { ensureMpfFormColumns } from "@/lib/mpfForm";
import MpfDoneClient from "@/components/MpfDoneClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "eMPF registration",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MpfDonePage({ params }: { params: { token: string } }) {
  const t = getT();
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({
    where: { mpfFormToken: params.token },
    select: { name: true, mpfFormCompletedAt: true },
  });

  if (!employee) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-3">
        <ShieldAlert size={40} className="text-danger-500" />
        <h1 className="font-display text-xl font-semibold text-ink">{t("This Link Isn't Valid")}</h1>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{COMPANY.shortName || COMPANY.name}</p>
        <h1 className="font-display text-2xl font-semibold text-ink mt-2">{employee.name}</h1>
        <p className="mt-3 text-sm text-ink">{t("Have you finished on eMPF?")}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>{t("HR Plus entered your name, phone number, and HKID in eMPF.")}</li>
          <li>{t("You opened the job notice in the eMPF app or website.")}</li>
          <li>{t("You chose your fund and signed online.")}</li>
        </ol>
        <MpfDoneClient token={params.token} alreadyDone={Boolean(employee.mpfFormCompletedAt)} />
      </div>
    </div>
  );
}
