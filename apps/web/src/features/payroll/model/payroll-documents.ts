import { CheckCircle2, ClipboardList, WalletCards } from "lucide-react"
import { formatDateTime, humanizeEnum } from "@/lib/format"

export type Page<T> = {
  rows: T[]
  page: number
  pageSize: number
  total: number
}

export type Payslip = {
  id: string
  reference: string
  employeeName: string
  employeeNumber: string
  gross: string
  deductions: string
  net: string
  currency: string
  revision: number
  calculationId: string
  generatedAt: string
  generatedBy: string
  publishedAt: string | null
  publishedBy: string | null
  period: {
    cutoffLabel: string
    startDate: string
    endDate: string
    configuration: { frequency: string }
  }
  lines: { name: string; componentType: string; amount: string }[]
}

export type Request = {
  id: string
  type: string
  status: string
  createdAt: string
  updatedAt: string
  withdrawnAt: string | null
  withdrawnBy: string | null
  needsFinancialCorrection: boolean
  employee: { fullName: string; employeeId: string }
  payslip: { id: string; reference: string } | null
  messages: { id: string; isAdmin: boolean; body: string; createdAt: string }[]
  activity?: {
    id: string
    action: string
    actorRoleAtTime: string
    changedFields: string[]
    createdAt: string
    changes: {
      activity?: string
      type?: { before: string; after: string }
      description?: { before: string; after: string }
      payslipId?: { before: string | null; after: string | null }
      requestStatus?: { before: string; after: string }
    }
  }[]
}

export const requestFilterTriggerClass = "w-[240px]"

export const requestTypes = [
  { value: "MISSING_PAYSLIP", label: "Missing payslip" },
  { value: "PAYSLIP_CORRECTION", label: "Payslip correction" },
  { value: "PAYROLL_DISCREPANCY", label: "Payroll discrepancy" },
  { value: "MISSING_SALARY_PAYMENT", label: "Missing salary payment report" },
]

export const payrollHistoryViews = [
  { value: "payslips", label: "Payslips", icon: WalletCards },
  { value: "runs", label: "Approved Runs", icon: CheckCircle2 },
  { value: "requests", label: "Payroll Requests", icon: ClipboardList },
] as const

export type PayslipLifecycleStatus =
  | "NOT_GENERATED"
  | "PARTIALLY_GENERATED"
  | "GENERATED"
  | "PARTIALLY_PUBLISHED"
  | "PUBLISHED"

export function payslipStatusLabel(status: PayslipLifecycleStatus) {
  return status === "NOT_GENERATED"
    ? "Not generated"
    : status === "PARTIALLY_GENERATED"
      ? "Partially generated"
      : status === "GENERATED"
        ? "Generated"
        : status === "PARTIALLY_PUBLISHED"
          ? "Partially published"
          : "Published"
}

export function payslipStatusTone(status: PayslipLifecycleStatus) {
  return status === "PUBLISHED"
    ? "success"
    : status === "GENERATED"
      ? "info"
      : status === "NOT_GENERATED"
        ? "neutral"
        : "warning"
}

export const relatedPayslipTypes = new Set([
  "PAYSLIP_CORRECTION",
  "PAYROLL_DISCREPANCY",
  "MISSING_SALARY_PAYMENT",
])

export const requestStatuses = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"].map(
  (value) => ({ value, label: humanizeEnum(value) }),
)

export const timestamp = (value: string) => formatDateTime(value, "Asia/Manila")

export const money = (slip: Payslip, amount: string) =>
  slip.currency + " " + amount

export const staffPayslipGrid =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"

export const staffRequestGrid =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"

export const staffTableRow =
  "min-h-[58px] border-b border-[#eceef1] bg-background px-4 py-3 text-xs text-foreground last:border-b-0 @max-[900px]:grid-cols-2 @max-[900px]:[&>*:last-child]:col-span-2"
