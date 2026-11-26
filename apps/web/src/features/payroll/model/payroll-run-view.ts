import { formatPayrollDate } from "./period-format"
import type {
  PayrollCalculationStatus,
  PayrollFrequency,
  PayrollRun,
  PayrollRunItem,
  PayrollRunStatus,
} from "../api/payroll-runs-api"

export type PanelMode = "generate" | "create-run" | null

export type RunFilter = "" | PayrollRunStatus

export type FrequencyFilter = "" | PayrollFrequency

export const approvalColumns =
  "grid grid-cols-[minmax(0,22fr)_minmax(0,17fr)_minmax(0,17fr)_minmax(0,10fr)_minmax(0,17fr)_minmax(0,9fr)_minmax(42px,8fr)] items-center gap-3"

export const payrollRunColumns =
  "grid grid-cols-[minmax(0,21fr)_minmax(0,11fr)_minmax(0,11fr)_minmax(0,19fr)_minmax(0,15fr)_minmax(0,12fr)_minmax(0,11fr)] items-center gap-3 @max-[760px]:grid-cols-[minmax(0,1.35fr)_minmax(0,.85fr)_minmax(0,1fr)_minmax(0,1.2fr)_48px] @max-[480px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @max-[480px]:gap-2"

export const compactApprovalColumns =
  "max-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1fr)_32px] max-[560px]:grid-cols-[minmax(0,1fr)_minmax(90px,.8fr)_32px]"

export const approvalMobileHidden = "max-[560px]:hidden"

export const itemColumns =
  "grid grid-cols-[minmax(0,1fr)_76px_96px_96px_32px] items-center gap-2 px-3 @max-[460px]:grid-cols-[minmax(0,1fr)_76px_96px_32px] @max-[320px]:grid-cols-[minmax(0,1fr)_76px_32px]"

export const approvalItemColumns =
  "grid min-w-[538px] grid-cols-[minmax(94px,1fr)_repeat(3,minmax(100px,1fr))_68px_40px] items-center gap-1 px-2 text-[11px]"

export const approvalAmountCell =
  "text-right tabular-nums [overflow-wrap:anywhere]"

export const itemNetColumn = "@max-[320px]:hidden"

export const itemGrossColumn = "@max-[460px]:hidden"

export function manilaYear() {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(new Date()),
  )
}

export function formatPeriodRange(
  startDate: string,
  endDate: string,
  monthStyle: "short" | "long" = "short",
) {
  const [startYear, startMonth, startDay] = startDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  const [endYear, endMonth, endDay] = endDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  if (startYear === endYear && startMonth === endMonth) {
    const month = new Intl.DateTimeFormat("en-PH", {
      month: monthStyle,
      timeZone: "UTC",
    }).format(new Date(Date.UTC(startYear, startMonth - 1, startDay)))
    if (startDay === endDay) return `${month} ${startDay}, ${startYear}`
    return `${month} ${startDay}–${endDay}, ${startYear}`
  }
  return `${formatPayrollDate(startDate)} – ${formatPayrollDate(endDate)}`
}

export function formatMoney(value: string | null | undefined) {
  if (value === null || value === undefined) return "—"
  const [whole = "0", fraction = "00"] = value.split(".")
  const sign = whole.startsWith("-") ? "−" : ""
  const absolute = whole.replace(/^-/, "")
  return `₱${sign}${absolute.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`
}

export function frequencyLabel(value: PayrollFrequency) {
  return value === "MONTHLY" ? "Monthly" : "Semi-monthly"
}

export function runStatusLabel(value: PayrollRunStatus) {
  return {
    DRAFT: "Draft",
    CALCULATED: "Calculated",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[value]
}

export function calculationStatusLabel(value: PayrollCalculationStatus) {
  if (value === "COMPLETE") return "No review flags"
  if (value === "BLOCKED") return "Blocked"
  return "Review required"
}

export function calculationTone(value: PayrollCalculationStatus) {
  if (value === "COMPLETE") return "success" as const
  if (value === "BLOCKED") return "danger" as const
  return "warning" as const
}

export function matchesRun(run: PayrollRun, query: string) {
  return [run.period.cutoffLabel, run.id].some((value) =>
    value.toLowerCase().includes(query),
  )
}

export function matchesItem(item: PayrollRunItem, query: string) {
  return [item.employeeName, item.employeeNumber].some((value) =>
    value.toLowerCase().includes(query),
  )
}

export function itemStatusLabel(value: PayrollRunItem["status"]) {
  if (value === "CALCULATED") return "Calculated"
  if (value === "BLOCKED") return "Blocked"
  return "Review"
}

export function itemStatusTone(value: PayrollRunItem["status"]) {
  if (value === "CALCULATED") return "success" as const
  if (value === "BLOCKED") return "danger" as const
  return "warning" as const
}

export function submissionFor(revision: PayrollRun["latestCalculation"]) {
  return revision?.approvalEvents?.find(
    ({ action }) =>
      action === "PAYROLL_SUBMITTED" || action === "PAYROLL_RESUBMITTED",
  )
}

export const approvalTimestamp = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
})
