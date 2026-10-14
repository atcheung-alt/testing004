export const SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "bookings", label: "Bookings" },
  { id: "quotations", label: "Quotations" },
  { id: "templates", label: "Templates" },
  { id: "invoices", label: "Invoices" },
  { id: "expenses", label: "Expenses" },
  { id: "receipts", label: "Receipts" },
  { id: "recruitment", label: "Recruitment" },
  { id: "clients", label: "Clients" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
