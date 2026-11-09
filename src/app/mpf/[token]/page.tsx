import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";
import { ensureMpfFormColumns, MPF_VIDEO_URL } from "@/lib/mpfForm";
import MpfUploadClient from "@/components/MpfUploadClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Individual eMPF Form",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MpfUploadPage({ params }: { params: { token: string } }) {
  const t = getT();
  await ensureMpfFormColumns();
  const employee = await prisma.employee.findUnique({
    where: { mpfFormToken: params.token },
    select: { name: true, mpfFormDriveFileId: true },
  });

  if (!employee) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center text-center gap-3">
        <ShieldAlert size={40} className="text-danger-500" />
        <h1 className="font-display text-xl font-semibold text-ink">{t("This Link Isn't Valid")}</h1>
        <p className="text-sm text-ink-muted">
          {t("Please contact {company} if you need a new link.", { company: COMPANY.shortName || COMPANY.name })}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="card p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{COMPANY.shortName || COMPANY.name}</p>
        <h1 className="font-display text-2xl font-semibold text-ink mt-2">{employee.name}</h1>
        <p className="mt-2 text-sm text-ink-muted">{t("This link is only for you. No login.")}</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink">
          <li>
            {t("Watch this video. It shows how to register, manage, and check your MPF:")}{" "}
            <a className="text-brand-600 underline" href={MPF_VIDEO_URL}>
              {MPF_VIDEO_URL}
            </a>
          </li>
          <li>{t("Open the attached Individual eMPF Form, fill it in, and sign it.")}</li>
          <li>{t("Upload the signed Individual eMPF Form here.")}</li>
        </ol>
        <MpfUploadClient token={params.token} saved={Boolean(employee.mpfFormDriveFileId)} />
      </div>
    </div>
  );
}
