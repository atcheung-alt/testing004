import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { isValidEmail } from "@/lib/settings";
import { ensureOnboardingToken, onboardingUrlFor } from "@/lib/signing";
import { sendDocumentEmail } from "@/lib/mailer";
import { logActivity } from "@/lib/activity";
import { splitNameGuess } from "@/lib/employees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Lightweight employee creation: just name + email, immediately followed by
// an emailed onboarding link — the rest of the record (HKID, address, bank
// details, etc.) gets filled in by the employee themselves via
// /onboarding/[token]. Employment specifics (title, salary, start date,
// annual leave) aren't collected here at all; admin fills those in later
// through the normal Edit form once the person is confirmed as staff.
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const employmentType = body.employmentType === "PART_TIME" || body.employmentType === "FREELANCE" ? body.employmentType : body.employmentType === "FULL_TIME" ? "FULL_TIME" : "";

  if (!name) {
    return NextResponse.json({ error: "Please enter the employee's name." }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!employmentType) {
    return NextResponse.json({ error: "Choose full time, part time, or freelance." }, { status: 400 });
  }

  const requestedCompanyId = typeof body.companyId === "string" ? body.companyId : "";
  let companyId = requestedCompanyId;
  if (companyId) {
    const company = await prisma.employerCompany.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return NextResponse.json({ error: "Choose a company." }, { status: 400 });
  } else {
    const companies = await prisma.employerCompany.findMany({ select: { id: true, name: true, sortOrder: true } });
    const existing = companies.find((company) => company.name.toLowerCase().replace(/[^a-z]/g, "") === "hrplus");
    if (existing) {
      companyId = existing.id;
    } else {
      const lastOrder = companies.reduce((max, company) => Math.max(max, company.sortOrder), 0);
      const created = await prisma.employerCompany.create({ data: { name: "HR Plus", sortOrder: lastOrder + 1 } });
      companyId = created.id;
    }
  }

  // Invited employees start life in ONBOARDING (not the schema default
  // ACTIVE) — they only become ACTIVE once staff verifies their signed
  // contract. Employees added directly via the New employee form (which
  // never calls this route) keep defaulting to ACTIVE, since that flow is
  // for already-established hires bypassing self-service onboarding.
  // This quick-invite step only ever collects one combined name field (see
  // the comment above) — best-effort split into surname/given name so
  // surnameEn/givenNameEn aren't left empty; the employee can correct the
  // split themselves on the onboarding form, or admin can fix it later on
  // the Edit form.
  const { surname: surnameEn, given: givenNameEn } = splitNameGuess(name);
  const employee = await prisma.employee.create({
    data: { name, surnameEn, givenNameEn, email, status: "ONBOARDING", companyId, employmentType },
  });

  await logActivity({
    documentType: "employee",
    documentId: employee.id,
    type: "CREATED",
    description: `Employee record for ${employee.name} created (invited to onboard)`,
  });

  const token = await ensureOnboardingToken(employee.id);
  const onboardingUrl = token ? onboardingUrlFor(token, request) : null;

  if (onboardingUrl) {
    try {
      await sendDocumentEmail({
        to: email,
        subject: "Welcome — please complete your onboarding details",
        body: `Hi ${name},\n\nPlease click the button below to fill in your personal details for our records. This only needs to be done once.`,
        signingUrl: onboardingUrl,
        ctaLabel: "Fill in my details",
      });
      await prisma.employee.update({
        where: { id: employee.id },
        data: { onboardingSentAt: new Date() },
      });
      await logActivity({
        documentType: "employee",
        documentId: employee.id,
        type: "EMAIL_SENT",
        description: `Onboarding invite emailed to ${email}`,
      });
    } catch (err: any) {
      // The employee record itself was created successfully — surface the
      // email failure distinctly so the caller can show a targeted warning
      // ("created, but the invite didn't send") rather than a hard error
      // that implies nothing happened at all.
      return NextResponse.json(
        {
          ...employee,
          emailError: err?.message || "Failed to send the onboarding email.",
        },
        { status: 201 }
      );
    }
  }

  return NextResponse.json(employee, { status: 201 });
}
