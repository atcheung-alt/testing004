import { prisma } from "@/lib/prisma";

export type ClientMatch = {
  name: string;
  contacts: { email: string | null }[];
};

function norm(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

/** A saved quotation or invoice belongs to this client when the company name
 *  matches, or when the document email is one of the client's contacts.
 *  Documents keep their own copy of the customer, so renaming a client later
 *  does not rewrite them. */
export function documentMatchesClient(
  doc: { customerName: string; customerEmail?: string | null },
  client: ClientMatch
) {
  const name = norm(client.name);
  if (name && norm(doc.customerName) === name) return true;
  const email = norm(doc.customerEmail);
  if (!email) return false;
  return client.contacts.some((contact) => norm(contact.email) === email);
}

export type ClientMoney = {
  quoteCount: number;
  invoiceCount: number;
  outstanding: number;
  paid: number;
};

type QuoteRow = { customerName: string; customerEmail: string | null };
type InvoiceRow = {
  customerName: string;
  customerEmail: string | null;
  status: string;
  total: number;
};

export function summarizeClient(client: ClientMatch, quotes: QuoteRow[], invoices: InvoiceRow[]): ClientMoney {
  const matchedQuotes = quotes.filter((quote) => documentMatchesClient(quote, client));
  const matchedInvoices = invoices.filter((invoice) => documentMatchesClient(invoice, client));
  const outstanding = matchedInvoices
    .filter(
      (invoice) =>
        invoice.status === "UNPAID" || invoice.status === "OVERDUE" || invoice.status === "PENDING_VERIFICATION"
    )
    .reduce((sum, invoice) => sum + invoice.total, 0);
  const paid = matchedInvoices
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + invoice.total, 0);
  return {
    quoteCount: matchedQuotes.length,
    invoiceCount: matchedInvoices.length,
    outstanding,
    paid,
  };
}

export async function loadDocumentIndex() {
  const [quotes, invoices] = await Promise.all([
    prisma.quotation.findMany({
      select: { customerName: true, customerEmail: true },
    }),
    prisma.invoice.findMany({
      select: { customerName: true, customerEmail: true, status: true, total: true },
    }),
  ]);
  return { quotes, invoices };
}

export async function customerFieldsForClient(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { contacts: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!customer) return null;
  const contact = customer.contacts[0];
  return {
    name: customer.name,
    customerName: customer.name,
    customerContact: contact?.name || "",
    customerEmail: contact?.email || "",
    customerPhone: "",
    customerAddress: customer.address || "",
  };
}

export async function loadAllDocuments() {
  const [quotations, invoices] = await Promise.all([
    prisma.quotation.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        customerName: true,
        customerEmail: true,
        status: true,
        total: true,
        issueDate: true,
      },
      orderBy: { issueDate: "desc" },
    }),
    prisma.invoice.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        customerName: true,
        customerEmail: true,
        status: true,
        total: true,
        issueDate: true,
        dueDate: true,
      },
      orderBy: { issueDate: "desc" },
    }),
  ]);
  return { quotations, invoices };
}

export async function loadClientDocuments(client: ClientMatch) {
  const all = await loadAllDocuments();
  return {
    quotations: all.quotations.filter((quote) => documentMatchesClient(quote, client)),
    invoices: all.invoices.filter((invoice) => documentMatchesClient(invoice, client)),
  };
}
