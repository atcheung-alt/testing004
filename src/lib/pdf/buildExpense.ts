import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { getEffectiveCompany } from "@/lib/appSettings";
import { ExpensePdf, type ExpensePdfData } from "@/lib/pdf/ExpensePdf";

export type BuiltExpense = {
  data: ExpensePdfData;
  buffer: Buffer;
  number: string;
  customerName: string;
  customerEmail: string | null;
};

export async function buildExpensePdf(
  invoiceId: string,
  expenseId: string,
  languageOverride?: string | null
): Promise<BuiltExpense | null> {
  const expense = await prisma.invoiceExpense.findFirst({
    where: { id: expenseId, invoiceId },
    include: {
      invoice: { select: { number: true, customerName: true, customerEmail: true } },
    },
  });
  if (!expense) return null;

  const company = await getEffectiveCompany();
  const description = expense.category === "Others" ? expense.label : "";
  const data: ExpensePdfData = {
    language: languageOverride,
    category: expense.category,
    description,
    amountLabel: formatCurrency(expense.amount),
    dateLabel: formatDate(expense.createdAt),
    invoiceNumber: expense.invoice.number,
    customerName: expense.invoice.customerName,
    companyName: company.shortName || company.name,
  };

  return {
    data,
    buffer: await renderToBuffer(React.createElement(ExpensePdf, { data }) as React.ReactElement),
    number: `${expense.invoice.number}-expense`,
    customerName: expense.invoice.customerName,
    customerEmail: expense.invoice.customerEmail,
  };
}
