import { notFound, redirect } from "next/navigation"
import { BillingPage } from "@/features/billing/pages/billing-page"

const pages: Record<string, [string, string]> = {
  overview: [
    "Overview",
    "Monitor invoicing, collections, outstanding balances, and financial activity.",
  ],
  "management/invoices": [
    "Invoices",
    "Review invoices and their outstanding balances.",
  ],
  "management/payments": [
    "Payments",
    "Review collections and their allocation to invoices.",
  ],
  expenses: [
    "Expenses",
    "Track operational expenses and related financial records.",
  ],
  "reports/revenue": ["Revenue", "Review revenue from invoiced services."],
  "reports/collections": [
    "Collections",
    "Review payments collected for invoiced services.",
  ],
  "reports/receivables": [
    "Receivables",
    "Review outstanding invoice balances.",
  ],
  "reports/expense-summary": [
    "Expense Summary",
    "Review operational expense activity.",
  ],
  "settings/billing-configuration": [
    "Billing Configuration",
    "Manage billing defaults and terms.",
  ],
  "settings/payment-methods": [
    "Payment Methods",
    "Manage payment method labels.",
  ],
  "settings/invoice-numbering": [
    "Invoice Numbering",
    "Manage invoice numbering conventions.",
  ],
}
const defaults: Record<string, string> = {
  management: "management/invoices",
  reports: "reports/revenue",
  settings: "settings/billing-configuration",
}

export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const path = (await params).path.join("/")
  if (defaults[path]) redirect(`/billing-finance/${defaults[path]}`)
  const page = pages[path]
  if (!page) notFound()
  return (
    <BillingPage
      title={page[0]}
      description={page[1]}
      invoices={path === "management/invoices"}
    />
  )
}
