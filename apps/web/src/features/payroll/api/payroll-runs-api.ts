import { apiRequest } from "@/features/auth/api/auth-api"
import type { PayrollFrequency } from "./payroll-api"
export type { PayrollFrequency } from "./payroll-api"

export type PayrollPeriod = {
  id: string
  configurationId: string
  startDate: string
  endDate: string
  cutoffLabel: string
  status: "OPEN"
  frequency: PayrollFrequency
  firstCutoffDay: number | null
  currency: "PHP"
  configuration: {
    id: string
    frequency: PayrollFrequency
    firstCutoffDay: number | null
    currency: "PHP"
    effectiveFrom: string
    effectiveTo: string | null
  }
  createdAt: string
  createdBy: { id: string; fullName: string | null; role: string }
  run: {
    id: string
    status: PayrollRunStatus
    createdAt: string
    latestCalculation: PayrollCalculationSummary | null
  } | null
}

export type PayrollRunStatus =
  "DRAFT" | "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
export type PayrollApprovalAction = "submit" | "approve" | "reject"
export type PayrollApprovalEvent = {
  id: string
  action: string
  actorId: string
  actorName: string | null
  reason: string | null
  createdAt: string
}
export type PayrollCalculationStatus =
  "COMPLETE" | "REVIEW_REQUIRED" | "BLOCKED"
export type PayrollRunItemStatus = "CALCULATED" | "REVIEW_REQUIRED" | "BLOCKED"

export type PayrollCalculationSummary = {
  id: string
  revision: number
  status: PayrollCalculationStatus
  calculatedAt: string
  currency: "PHP"
  grossTotal: string
  deductionsTotal: string
  netTotal: string
  calculatedItemCount: number
  reviewItemCount: number
  blockedItemCount: number
  approvalEvents?: PayrollApprovalEvent[]
  createdBy?: { id: string; fullName: string | null; role: string }
}

export type PayrollRun = {
  id: string
  status: PayrollRunStatus
  calculationCount: number
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string | null; role: string }
  period: {
    id: string
    configurationId: string
    startDate: string
    endDate: string
    cutoffLabel: string
    status: "OPEN"
    frequency: PayrollFrequency
    firstCutoffDay: number | null
    currency: "PHP"
  }
  latestCalculation: PayrollCalculationSummary | null
  calculationHistory: PayrollCalculationSummary[]
}

export type PayrollCalculationIssue = {
  code: string
  message: string
  reference?: string
}

export type PayrollRunItemComponent = {
  id: string
  componentType: "BASE_EARNING" | "ALLOWANCE" | "DEDUCTION"
  status: "CALCULATED" | "UNRESOLVED"
  sourceId: string | null
  name: string
  amount: string | null
  metadata: Record<string, string | number | boolean | null>
}

export type PayrollRunItem = {
  id: string
  employeeId: string
  employeeNumber: string
  employeeName: string
  employmentType: string
  status: PayrollRunItemStatus
  currency: "PHP"
  grossAmount: string | null
  deductionsAmount: string | null
  netAmount: string | null
  compensationSnapshot: {
    id: string
    payType: "MONTHLY" | "DAILY" | "HOURLY"
    baseRate: string
    currency: string
    effectiveFrom: string
    effectiveTo: string | null
    components: {
      id: string
      type: "ALLOWANCE" | "RECURRING_DEDUCTION"
      name: string
      amount: string
      calculationType: "FIXED"
    }[]
  }[]
  attendanceSnapshot: {
    policyMissing: boolean
    expectedWorkdays: { workDate: string; requiredMinutes: number }[]
    workdays: {
      id: string
      workDate: string
      requiredMinutes: number
      sessions: { id: string; startedAt: string; endedAt: string | null }[]
    }[]
    overtimeAdjustments: {
      id: string
      status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED"
      overtimeMinutes: number
    }[]
  }
  warnings: PayrollCalculationIssue[]
  blocks: PayrollCalculationIssue[]
  calculation: {
    id: string
    revision: number
    status: PayrollCalculationStatus
    calculatedAt: string
  }
  components: PayrollRunItemComponent[]
}

export type PayrollPage<T> = {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export type PayrollPeriodGeneration = {
  year: number
  createdCount: number
  total: number
  rows: PayrollPeriod[]
}

export async function listPayrollPeriods(input: {
  page: number
  year?: number
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ page: String(input.page) })
  if (input.year) params.set("year", String(input.year))
  return apiRequest<PayrollPage<PayrollPeriod>>(
    `/api/payroll/periods?${params}`,
    { signal: input.signal },
  )
}

export async function listAllPayrollPeriodsForYear(
  year: number,
  signal?: AbortSignal,
): Promise<PayrollPeriod[]> {
  const firstPage = await listPayrollPeriods({ page: 1, year, signal })
  const totalPages = Math.ceil(firstPage.total / firstPage.pageSize)
  if (totalPages <= 1) return firstPage.rows
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      listPayrollPeriods({ page: index + 2, year, signal }),
    ),
  )
  return [...firstPage.rows, ...rest.flatMap(({ rows }) => rows)]
}

export function generatePayrollPeriods(year: number) {
  return apiRequest<PayrollPeriodGeneration>("/api/payroll/periods", {
    method: "POST",
    body: JSON.stringify({ year }),
  })
}

export function getCurrentPayrollPeriod(signal?: AbortSignal) {
  return apiRequest<{
    today: string
    candidate: {
      configurationId: string
      frequency: PayrollFrequency
      startDate: string
      endDate: string
      cutoffLabel: string
    } | null
    period: PayrollPeriod | null
  }>("/api/payroll/periods/current", { signal })
}

export async function listPayrollRuns(input: {
  page: number
  approvals?: boolean
  search?: string
  status?: "" | PayrollRunStatus
  frequency?: "" | PayrollFrequency
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ page: String(input.page) })
  if (input.search) params.set("search", input.search)
  if (input.status) params.set("status", input.status)
  if (input.frequency) params.set("frequency", input.frequency)
  return apiRequest<PayrollPage<PayrollRun>>(
    `/api/payroll/${input.approvals ? "approvals" : "runs"}?${params}`,
    {
      signal: input.signal,
    },
  )
}

export function createPayrollRun(periodId: string) {
  return apiRequest<PayrollRun>("/api/payroll/runs", {
    method: "POST",
    body: JSON.stringify({ periodId }),
  })
}

export function getPayrollRun(runId: string, signal?: AbortSignal) {
  return apiRequest<PayrollRun>(
    `/api/payroll/runs/${encodeURIComponent(runId)}`,
    { signal },
  )
}

export function calculatePayrollRun(runId: string) {
  return apiRequest<PayrollRun>(
    `/api/payroll/runs/${encodeURIComponent(runId)}/calculate`,
    { method: "POST" },
  )
}

export function listPayrollRunItems(
  runId: string,
  input: {
    page: number
    search?: string
    calculationId?: string
    signal?: AbortSignal
  },
) {
  const params = new URLSearchParams({ page: String(input.page) })
  if (input.search) params.set("search", input.search)
  if (input.calculationId) params.set("calculationId", input.calculationId)
  return apiRequest<
    PayrollPage<PayrollRunItem> & { calculationId: string | null }
  >(`/api/payroll/runs/${encodeURIComponent(runId)}/items?${params}`, {
    signal: input.signal,
  })
}

export function getPayrollRunItem(
  runId: string,
  itemId: string,
  signal?: AbortSignal,
) {
  return apiRequest<PayrollRunItem>(
    `/api/payroll/runs/${encodeURIComponent(runId)}/items/${encodeURIComponent(itemId)}`,
    { signal },
  )
}

export function transitionPayrollApproval(
  runId: string,
  calculationId: string,
  action: PayrollApprovalAction,
  reason: string,
) {
  return apiRequest<PayrollRun>(
    `/api/payroll/runs/${encodeURIComponent(runId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify({ calculationId, reason }),
    },
  )
}
