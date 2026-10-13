const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

// Keep the seed's wording aligned with the standardized templates without
// importing the TS module: mirror the defaults here.
const PAYMENT_DUE_DAYS = 30;
const REMINDER = [
  "• Please complete payment before the due date.",
  "• Kindly include the invoice number or quotation number as the payment reference.",
  "• Please contact us if you have any questions regarding this document.",
].join("\n");
const TERMS = [
  "1. All prices quoted are in Hong Kong Dollars (HKD).",
  `2. Payment shall be made within ${PAYMENT_DUE_DAYS} days from the invoice date.`,
  "3. Any bank charges incurred must be borne solely by the Client.",
  "4. Please confirm your booking or order at least 2 weeks in advance.",
  "5. Quotations are valid for 30 days from the date of issue.",
  "6. Any bank charges incurred during payment are to be borne by the Client.",
  "7. HR Plus reserves the right to amend these terms where reasonably required.",
  "8. By signing this document, the Client agrees to the terms and conditions stated herein.",
].join("\n");

async function main() {
  // A couple of reusable preset items for the item library.
  const presets = [
    {
      id: "seed-preset-1",
      name: "HR System Setup",
      description: "Core HR platform configuration, roles, and approval workflows.",
      unit: "project",
      unitPrice: 4200,
    },
    {
      id: "seed-preset-2",
      name: "Employee Self-Service Portal",
      description: "Leave, attendance, and payslip access for staff and managers.",
      unit: "module",
      unitPrice: 850,
    },
    {
      id: "seed-preset-3",
      name: "Data Migration & Training",
      description: "Import existing employee records and train HR staff.",
      unit: "round",
      unitPrice: 600,
    },
  ];
  for (const preset of presets) {
    await prisma.presetItem.upsert({
      where: { id: preset.id },
      update: {},
      create: preset,
    });
  }

  const items = [
    { name: "HR System Setup", description: "Core HR platform configuration, roles, and approval workflows.", unit: "project", quantity: 1, unitPrice: 4200, amount: 4200, sortOrder: 0 },
    { name: "Employee Self-Service Portal", description: "Leave, attendance, and payslip access for staff and managers.", unit: "module", quantity: 3, unitPrice: 850, amount: 2550, sortOrder: 1 },
    { name: "Data Migration & Training", description: "Import existing employee records and train HR staff.", unit: "round", quantity: 2, unitPrice: 600, amount: 1200, sortOrder: 2 },
  ];
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxRate = 7.5;
  const discount = 300;
  const taxAmount = ((subtotal - discount) * taxRate) / 100;
  const total = subtotal - discount + taxAmount;

  await prisma.quotation.upsert({
    where: { number: "QT-2026-0001" },
    update: {},
    create: {
      number: "QT-2026-0001",
      title: "HR Management System",
      customerName: "TechVision Limited",
      customerContact: "Sarah Chen",
      customerEmail: "accounts@techvision.com",
      customerPhone: "+852 3905 0662",
      customerAddress: "12/F, Harbour Centre, 25 Harbour Road, Wan Chai, Hong Kong",
      status: "SENT",
      signingToken: crypto.randomBytes(24).toString("base64url"),
      taxRate,
      discount,
      subtotal,
      taxAmount,
      total,
      paymentDueDays: PAYMENT_DUE_DAYS,
      notes: "Thank you for the opportunity to quote on this project.",
      reminder: REMINDER,
      terms: TERMS,
      items: { create: items },
    },
  });

  // A sample invoice with realistic data (no signature — add one from the UI).
  const invItems = [
    { name: "Website Revamp", description: "Responsive redesign of the corporate website, 10 pages.", unit: "project", quantity: 1, unitPrice: 5200, amount: 5200, sortOrder: 0 },
    { name: "CMS Training", description: "Two half-day training sessions for the marketing team.", unit: "session", quantity: 2, unitPrice: 750, amount: 1500, sortOrder: 1 },
  ];
  const invSub = invItems.reduce((s, i) => s + i.amount, 0);
  await prisma.invoice.upsert({
    where: { number: "INV-2026-0001" },
    update: {},
    create: {
      number: "INV-2026-0001",
      title: "Website Revamp",
      customerName: "Sunshine Holdings Ltd.",
      customerContact: "Daniel Wong",
      customerEmail: "finance@sunshineholdings.com",
      customerPhone: "+852 2890 1234",
      customerAddress: "Room 2103, Tower 2, Grand Central Plaza, Sha Tin, Hong Kong",
      status: "UNPAID",
      dueDate: new Date(Date.now() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000),
      taxRate: 0,
      discount: 0,
      subtotal: invSub,
      taxAmount: 0,
      total: invSub,
      paymentDueDays: PAYMENT_DUE_DAYS,
      notes: "Thank you for your business.",
      reminder: REMINDER,
      terms: TERMS,
      items: { create: invItems },
    },
  });

  const expenseCategories = [
    "Venue",
    "Staffing",
    "Transport",
    "Meals",
    "Equipment",
    "Materials",
    "Uniform",
    "Accommodation",
    "Subcontractor",
  ];
  const existingCategories = await prisma.expenseCategory.findMany({ select: { name: true } });
  const haveCategories = new Set(existingCategories.map((row) => row.name.trim().toLowerCase()));
  let sortOrder = existingCategories.length;
  for (const name of expenseCategories) {
    if (haveCategories.has(name.toLowerCase())) continue;
    await prisma.expenseCategory.create({ data: { name, sortOrder } });
    sortOrder += 1;
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
