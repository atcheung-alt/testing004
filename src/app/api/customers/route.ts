import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadDocumentIndex, summarizeClient } from "@/lib/clientWork";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || undefined;

  const [customers, documents] = await Promise.all([
    prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contacts: { some: { name: { contains: q, mode: "insensitive" } } } },
              { contacts: { some: { email: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : undefined,
      include: { contacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { name: "asc" },
    }),
    loadDocumentIndex(),
  ]);

  return NextResponse.json(
    customers.map((customer) => ({
      ...customer,
      ...summarizeClient(customer, documents.quotes, documents.invoices),
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  }

  // Every company requires at least one contact person, created together
  // with it — a Customer can never exist with zero contacts. The contact's
  // name and email are both optional — either, both, or neither can be left
  // blank (the contact can be filled in later once known), so no combined
  // requirement is enforced here.
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim().toLowerCase() : "";
  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  const contactName = typeof body.contactName === "string" ? body.contactName.trim() : "";

  // Only worth checking for a duplicate when there's actually an email to
  // match against — with no email stored there's nothing to look up.
  if (contactEmail) {
    const existingContact = await prisma.contactPerson.findUnique({ where: { email: contactEmail } });
    if (existingContact) {
      return NextResponse.json(
        { error: "A contact with that email is already in the library." },
        { status: 409 }
      );
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name,
      address: typeof body.address === "string" ? body.address.trim() || null : null,
      contacts: {
        create: { name: contactName || null, email: contactEmail || null },
      },
    },
    include: { contacts: true },
  });

  return NextResponse.json(customer, { status: 201 });
}
