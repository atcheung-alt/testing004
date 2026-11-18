export async function saveClientToLibrary(input: {
  company: string;
  contactName?: string;
  email?: string;
  address?: string;
}) {
  const company = input.company.trim();
  if (!company) throw new Error("Enter the company name first.");
  const contactName = (input.contactName || "").trim();
  const email = (input.email || "").trim();
  const listRes = await fetch("/api/customers");
  const list = await listRes.json().catch(() => []);
  const found = Array.isArray(list)
    ? list.find((customer: { name?: string }) => (customer.name || "").toLowerCase() === company.toLowerCase())
    : null;

  if (!found) {
    const created = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: company,
        address: input.address || "",
        contactName,
        contactEmail: email,
      }),
    });
    const data = await created.json().catch(() => ({}));
    if (!created.ok) throw new Error(data.error || "Could not save this client.");
    return "saved" as const;
  }

  const contacts = Array.isArray(found.contacts) ? found.contacts : [];
  const already = contacts.some((contact: { name?: string | null; email?: string | null }) => {
    if (email) return (contact.email || "").toLowerCase() === email.toLowerCase();
    return contactName && (contact.name || "").toLowerCase() === contactName.toLowerCase();
  });
  if (already || (!email && !contactName)) return "exists" as const;

  const added = await fetch(`/api/customers/${found.id}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: contactName, email }),
  });
  const data = await added.json().catch(() => ({}));
  if (!added.ok) throw new Error(data.error || "Could not save this client.");
  return "saved" as const;
}
