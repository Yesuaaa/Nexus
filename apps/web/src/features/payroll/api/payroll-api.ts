import { apiRequest } from "@/features/auth/api/auth-api"

export type PayrollPayType = "MONTHLY" | "DAILY" | "HOURLY"
export type CompensationComponentType = "ALLOWANCE" | "RECURRING_DEDUCTION"
export type PayrollFrequency = "MONTHLY" | "SEMI_MONTHLY"
export type CompensationConfigurationStatus =
  "CONFIGURED" | "NOT_CONFIGURED" | "FUTURE_REVISION"

export type CompensationComponent = {
  id?: string
  type: CompensationComponentType
  name: string
  amount: string
  calculationType?: "FIXED"
}

export type CompensationVersion = {
  id: string
  payType: PayrollPayType
  baseRate: string
  currency: "PHP"
  effectiveFrom: string
  effectiveTo: string | null
  changeReason: string
  createdAt: string
  components: CompensationComponent[]
}

export type PayrollCompensationRow = {
  employee: {
    id: string
    employeeId: string
    fullName: string
    employmentType: string
    status: "ACTIVE" | "INACTIVE" | "ON_LEAVE"
    department: { id: string; name: string } | null
  }
  compensation: CompensationVersion | null
  configurationStatus: CompensationConfigurationStatus
}

export type PayrollCompensationList = {
  rows: PayrollCompensationRow[]
  total: number
  page: number
  pageSize: number
}

export type CompensationDetails = {
  employee: {
    id: string
    employeeId: string
    fullName: string
    employmentType: string
    status: "ACTIVE" | "INACTIVE" | "ON_LEAVE"
    startDate: string | null
    department: { id: string; name: string } | null
  }
  current: CompensationVersion | null
  future: CompensationVersion | null
}

export type PayrollPeriodBoundary = {
  startDay: number
  endDay: number | "LAST_DAY"
}

export type PayrollConfiguration = {
  id: string
  frequency: PayrollFrequency
  firstCutoffDay: number | null
  currency: "PHP"
  effectiveFrom: string
  effectiveTo: string | null
  changeReason: string
  createdAt: string
  periods: PayrollPeriodBoundary[]
}

export type PayrollSettings = {
  current: PayrollConfiguration | null
  future: PayrollConfiguration | null
  capabilities: {
    simulatorEnabled: boolean
    payMongoEnabled: boolean
    sandboxDestinationKinds: ("TEST_BANK" | "TEST_EWALLET")[]
  }
}

export async function listPayrollCompensation(filters: {
  page: number
  search?: string
  departmentId?: string
  payType?: PayrollPayType | ""
  status?: CompensationConfigurationStatus | ""
  signal?: AbortSignal
}): Promise<PayrollCompensationList> {
  const params = new URLSearchParams({ page: String(filters.page) })
  if (filters.search) params.set("search", filters.search)
  if (filters.departmentId) params.set("departmentId", filters.departmentId)
  if (filters.payType) params.set("payType", filters.payType)
  if (filters.status) params.set("status", filters.status)
  return apiRequest<PayrollCompensationList>(
    `/api/payroll/compensation?${params}`,
    { signal: filters.signal },
  )
}

export function getPayrollCompensation(
  employeeId: string,
  signal?: AbortSignal,
) {
  return apiRequest<CompensationDetails>(
    `/api/payroll/compensation/${encodeURIComponent(employeeId)}`,
    { signal },
  )
}

export function getPayrollCompensationHistory(
  employeeId: string,
  signal?: AbortSignal,
) {
  return apiRequest<{ rows: CompensationVersion[] }>(
    `/api/payroll/compensation/${encodeURIComponent(employeeId)}/history`,
    { signal },
  )
}

export function createPayrollCompensationVersion(
  employeeId: string,
  input: {
    payType: PayrollPayType
    baseRate: string
    currency: "PHP"
    effectiveFrom: string
    changeReason: string
    components: Omit<CompensationComponent, "id" | "calculationType">[]
  },
) {
  return apiRequest<{ compensation: CompensationVersion }>(
    `/api/payroll/compensation/${encodeURIComponent(employeeId)}/versions`,
    { method: "POST", body: JSON.stringify(input) },
  )
}

export function getPayrollSettings(signal?: AbortSignal) {
  return apiRequest<PayrollSettings>("/api/payroll/settings", { signal })
}

export type PayrollPreferences = {
  revision: number
  showCompanyLogo: boolean
  showEmployeeId: boolean
  requirePublicationConfirmation: boolean
  requireSimulationConfirmation: boolean
}

export function getPayrollPreferences(signal?: AbortSignal) {
  return apiRequest<PayrollPreferences>("/api/payroll/settings/preferences", {
    signal,
  })
}

export function savePayrollPreferences(preferences: PayrollPreferences) {
  return apiRequest<PayrollPreferences>("/api/payroll/settings/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  })
}

export function getPayrollSettingsHistory(signal?: AbortSignal) {
  return apiRequest<{ rows: PayrollConfiguration[] }>(
    "/api/payroll/settings/history",
    { signal },
  )
}

export function createPayrollConfigurationVersion(input: {
  frequency: PayrollFrequency
  firstCutoffDay: number | null
  currency: "PHP"
  effectiveFrom: string
  changeReason: string
}) {
  return apiRequest<{ configuration: PayrollConfiguration }>(
    "/api/payroll/settings/versions",
    { method: "POST", body: JSON.stringify(input) },
  )
}
