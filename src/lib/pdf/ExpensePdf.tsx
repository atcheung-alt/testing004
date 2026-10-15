import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT, PDF_FONT_BOLD } from "@/lib/pdf/font";

export type ExpensePdfLanguage = "EN" | "ZH_HANT" | "ZH_HANS";

export type ExpensePdfData = {
  language?: string | null;
  category: string;
  description: string;
  amountLabel: string;
  dateLabel: string;
  invoiceNumber: string;
  customerName: string;
  companyName: string;
};

const LABELS: Record<
  ExpensePdfLanguage,
  {
    title: string;
    invoice: string;
    customer: string;
    category: string;
    description: string;
    amount: string;
    date: string;
  }
> = {
  EN: {
    title: "Expense",
    invoice: "Invoice",
    customer: "Customer",
    category: "Category",
    description: "Description",
    amount: "Amount",
    date: "Date",
  },
  ZH_HANT: {
    title: "支出",
    invoice: "發票",
    customer: "客戶",
    category: "類別",
    description: "說明",
    amount: "金額",
    date: "日期",
  },
  ZH_HANS: {
    title: "支出",
    invoice: "发票",
    customer: "客户",
    category: "类别",
    description: "说明",
    amount: "金额",
    date: "日期",
  },
};

function resolveLang(language?: string | null): ExpensePdfLanguage {
  return language === "ZH_HANS" || language === "ZH_HANT" ? language : "EN";
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT, fontSize: 11, color: "#1c1917", padding: 40 },
  company: { fontFamily: PDF_FONT_BOLD, fontSize: 12, marginBottom: 8 },
  title: { fontFamily: PDF_FONT_BOLD, fontSize: 20, marginBottom: 18 },
  row: { flexDirection: "row", marginBottom: 8 },
  label: { width: 110, color: "#78716c" },
  value: { flex: 1 },
});

export function ExpensePdf({ data }: { data: ExpensePdfData }) {
  const t = LABELS[resolveLang(data.language)];
  const rows = [
    [t.invoice, data.invoiceNumber],
    [t.customer, data.customerName],
    [t.category, data.category],
    [t.description, data.description],
    [t.amount, data.amountLabel],
    [t.date, data.dateLabel],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.company}>{data.companyName}</Text>
        <Text style={styles.title}>{t.title}</Text>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value || "—"}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
