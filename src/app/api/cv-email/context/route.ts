import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadCurrentNickname } from "@/lib/quotationAuthor";

export const runtime = "nodejs";

export async function GET() {
  const recruiter = await loadCurrentNickname().catch(() => "");
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { name: true, contacts: { select: { name: true, email: true }, orderBy: { createdAt: "asc" } } },
    });
    const clients = customers.map((customer) => {
      const contact = customer.contacts.find((person) => person.name && person.name.trim()) || customer.contacts[0];
      return {
        name: customer.name,
        contact: contact?.name?.trim() || "",
        email: contact?.email?.trim() || "",
      };
    });
    return NextResponse.json({ recruiter, clients });
  } catch {
    return NextResponse.json({ recruiter, clients: [] });
  }
}
