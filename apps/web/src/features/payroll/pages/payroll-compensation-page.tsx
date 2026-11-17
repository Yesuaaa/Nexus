"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Banknote, Plus, X } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass, focusRing } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { DateInput } from "@/components/ui/date-input"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { Form } from "@/components/ui/form"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { Pill } from "@/components/ui/pill"
import { SearchField } from "@/components/ui/search-field"
import {
  DetailItem,
  DetailList,
  SidePanel,
  SidePanelBody,
  SidePanelButton,
  SidePanelFieldset,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelSection,
} from "@/components/ui/side-panel"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import {
  createPayrollCompensationVersion,
  getPayrollCompensation,
  getPayrollCompensationHistory,
  listPayrollCompensation,
  type CompensationComponentType,
  type CompensationVersion,
  type PayrollCompensationRow,
  type PayrollPayType,
  type CompensationConfigurationStatus,
} from "../api/payroll-api"
import { formatPayrollMoney } from "../model/money"

const payTypes: { value: PayrollPayType | ""; label: string }[] = [
  { value: "", label: "All pay types" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "DAILY", label: "Daily" },
  { value: "HOURLY", label: "Hourly" },
]

const configurationStatuses: {
  value: CompensationConfigurationStatus | ""
  label: string
}[] = [
  { value: "", label: "All configurations" },
  { value: "CONFIGURED", label: "Configured" },
  { value: "NOT_CONFIGURED", label: "Not configured" },
  { value: "FUTURE_REVISION", label: "Future revision" },
]

const compensationGrid =
  "grid grid-cols-[minmax(105px,1.4fr)_minmax(70px,.9fr)_minmax(80px,1fr)_minmax(75px,.8fr)_minmax(95px,1fr)_minmax(90px,1fr)_minmax(95px,1fr)_minmax(80px,.9fr)] items-center gap-3"

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function dayAfter(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function payTypeLabel(value: PayrollPayType | null | undefined) {
  if (value === "MONTHLY") return "Monthly"
  if (value === "DAILY") return "Daily"
  if (value === "HOURLY") return "Hourly"
  return "—"
}

function statusLabel(status: CompensationConfigurationStatus) {
  if (status === "CONFIGURED") return "Configured"
  if (status === "FUTURE_REVISION") return "Future revision"
  return "Not configured"
}

function statusTone(status: CompensationConfigurationStatus) {
  if (status === "CONFIGURED") return "success" as const
  if (status === "FUTURE_REVISION") return "warning" as const
  return "neutral" as const
}

function matchesCompensation(row: PayrollCompensationRow, query: string) {
  const normalized = query.toLowerCase()
  return [row.employee.fullName, row.employee.employeeId].some((value) =>
    value.toLowerCase().includes(normalized),
  )
}

export function PayrollCompensationPage() {
  const account = usePortalAccount()
  const canManage = canManagePayroll(account)
  const [search, setSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [payType, setPayType] = useState<PayrollPayType | "">("")
  const [status, setStatus] = useState<CompensationConfigurationStatus | "">("")
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  )
  const list = usePaginatedList({
    params: { search: search.trim(), departmentId, payType, status },
    load: ({ page, signal }) =>
      listPayrollCompensation({
        page,
        search: search.trim(),
        departmentId,
        payType,
        status,
        signal,
      }),
    rows: (result) => result.rows,
    matches: matchesCompensation,
    initial: { rows: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Couldn't load employee compensation.",
  })
  const departments = useDepartments()
  const departmentOptions = [
    { value: "", label: "All departments" },
    ...departments.departments.map((department) => ({
      value: department.id,
      label: department.name,
    })),
  ]
  const hasFilters = Boolean(search.trim() || departmentId || payType || status)
  const allEmployeesAreUnconfigured = Boolean(
    list.data &&
    list.data.total === list.data.rows.length &&
    list.data.rows.length > 0 &&
    list.data.rows.every((row) => row.configurationStatus === "NOT_CONFIGURED"),
  )

  function updateFilter(update: () => void) {
    update()
    list.setPage(1)
  }

  function clearFilters() {
    updateFilter(() => {
      setSearch("")
      setDepartmentId("")
      setPayType("")
      setStatus("")
    })
  }

  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Employee Compensation"
    >
      <PageHeader
        title="Employee Compensation"
        description="Manage employee salary configurations, allowances, and recurring deductions."
        actions={!canManage ? <Pill tone="neutral">Read only</Pill> : undefined}
      />
      <section
        className="mt-[18px] min-w-0"
        aria-label="Compensation directory"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 max-[560px]:items-stretch">
          <div className={`${filterBarClass} min-w-0 max-[560px]:w-full`}>
            <SearchField
              label="Search employees"
              placeholder="Search employee name or ID…"
              value={search}
              maxLength={100}
              onChange={(event) =>
                updateFilter(() => setSearch(event.target.value))
              }
            />
            <FilterSelect
              label="Filter by department"
              value={departmentId}
              options={departmentOptions}
              disabled={departments.loading || Boolean(departments.error)}
              onChange={(value) => updateFilter(() => setDepartmentId(value))}
              triggerClassName="min-w-[170px]"
            />
            <FilterSelect
              label="Filter by pay type"
              value={payType}
              options={payTypes}
              onChange={(value) => updateFilter(() => setPayType(value))}
              triggerClassName="min-w-[140px]"
            />
            <FilterSelect
              label="Filter by configuration status"
              value={status}
              options={configurationStatuses}
              onChange={(value) => updateFilter(() => setStatus(value))}
              triggerClassName="min-w-[180px]"
            />
            {hasFilters && (
              <button
                type="button"
                className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs font-semibold text-[#294a9b] hover:bg-[#eef2fa] ${focusRing}`}
                onClick={clearFilters}
              >
                <X size={13} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>
        </div>
        {departments.error && (
          <Alert variant="text" className="mb-3" role="alert">
            Couldn't load the department filter. Compensation data is still
            available.
            <button
              className="ml-2 font-semibold underline"
              type="button"
              onClick={departments.retry}
            >
              Retry
            </button>
          </Alert>
        )}
        {list.loading && !list.data?.rows.length ? (
          <p className="py-12 text-center text-sm text-[#65718a]" role="status">
            Loading employee compensation…
          </p>
        ) : list.error ? (
          <EmptyState
            icon={Banknote}
            title="Compensation couldn't be loaded"
            description={list.error}
            role="alert"
            action={
              <Button variant="outline" onClick={list.retry}>
                Try again
              </Button>
            }
          />
        ) : list.rows.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title={
              hasFilters
                ? status === "CONFIGURED" && list.data?.total === 0
                  ? "No compensation configurations found"
                  : "No matching employees"
                : "No employees found"
            }
            description={
              hasFilters
                ? "Adjust the search or filters to see other employees."
                : "Employees appear here after they are added to Employee Management."
            }
            size="lg"
          />
        ) : (
          <>
            {allEmployeesAreUnconfigured && !hasFilters && (
              <p role="status" className="mb-3 text-xs text-[#65718a]">
                No compensation configurations yet. Select an employee to add
                the first version.
              </p>
            )}
            <ResponsiveDataTable
              label="Employee compensation"
              aria-busy={list.loading}
            >
              <ResponsiveDataTableHeader
                className="@max-[820px]:sr-only"
                rowClassName={compensationGrid}
              >
                {[
                  "Employee",
                  "Department",
                  "Employment type",
                  "Pay type",
                  "Base rate",
                  "Effective date",
                  "Status",
                  "Actions",
                ].map((label) => (
                  <ResponsiveDataTableColumnHeader key={label}>
                    {label}
                  </ResponsiveDataTableColumnHeader>
                ))}
              </ResponsiveDataTableHeader>
              <ResponsiveDataTableBody>
                {list.rows.map((row) => (
                  <ResponsiveDataTableRow
                    key={row.employee.id}
                    className={`${compensationGrid} border-b border-[#edf0f3] px-4 py-3 last:border-b-0 @max-[820px]:grid-cols-[minmax(0,1.2fr)_minmax(110px,.8fr)] @max-[820px]:gap-x-3 @max-[820px]:gap-y-1`}
                  >
                    <ResponsiveDataTableCell className="min-w-0 @max-[820px]:col-start-1 @max-[820px]:row-start-1">
                      <div className="truncate text-xs font-semibold">
                        {row.employee.fullName}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-[#738096]">
                        {row.employee.employeeId}
                      </div>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="truncate text-xs @max-[820px]:hidden">
                      {row.employee.department?.name ?? "—"}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="text-xs @max-[820px]:hidden">
                      {row.employee.employmentType
                        .replaceAll("_", " ")
                        .toLowerCase()}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="text-xs @max-[820px]:col-start-1 @max-[820px]:row-start-2">
                      <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                        Pay type
                      </span>
                      {payTypeLabel(row.compensation?.payType)}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="text-xs font-semibold @max-[820px]:col-start-2 @max-[820px]:row-start-1 @max-[820px]:text-right">
                      <span className="mr-1.5 hidden font-normal text-[#65718a] @max-[820px]:inline">
                        Rate
                      </span>
                      {formatPayrollMoney(row.compensation?.baseRate)}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="text-xs @max-[820px]:col-start-2 @max-[820px]:row-start-2 @max-[820px]:text-right">
                      <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                        From
                      </span>
                      {formatDate(row.compensation?.effectiveFrom)}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="@max-[820px]:col-start-1 @max-[820px]:row-start-3">
                      <span className="mr-1.5 hidden text-[#65718a] @max-[820px]:inline">
                        Status
                      </span>
                      <Pill tone={statusTone(row.configurationStatus)}>
                        {statusLabel(row.configurationStatus)}
                      </Pill>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="flex justify-end @max-[820px]:col-start-2 @max-[820px]:row-start-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`${canManage && row.configurationStatus === "NOT_CONFIGURED" ? "Configure" : "View"} compensation for ${row.employee.fullName}`}
                        onClick={() => setSelectedEmployeeId(row.employee.id)}
                      >
                        {canManage &&
                        row.configurationStatus === "NOT_CONFIGURED"
                          ? "Configure"
                          : "View"}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </ResponsiveDataTableCell>
                  </ResponsiveDataTableRow>
                ))}
              </ResponsiveDataTableBody>
            </ResponsiveDataTable>
            {list.footer && (
              <TablePaginationFooter
                {...list.footer}
                label="Compensation pages"
                itemLabel="employees"
                onPageChange={list.setPage}
              />
            )}
          </>
        )}
      </section>
      {selectedEmployeeId && (
        <CompensationPanel
          key={selectedEmployeeId}
          employeeId={selectedEmployeeId}
          canManage={canManage}
          onClose={() => setSelectedEmployeeId(null)}
          onSaved={() => {
            list.retry()
          }}
        />
      )}
    </main>
  )
}

type ComponentDraft = {
  type: CompensationComponentType
  name: string
  amount: string
}

function CompensationPanel({
  employeeId,
  canManage,
  onClose,
  onSaved,
}: {
  employeeId: string
  canManage: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const panel = useAsyncResource(
    async (signal) => {
      const [details, history] = await Promise.all([
        getPayrollCompensation(employeeId, signal),
        getPayrollCompensationHistory(employeeId, signal),
      ])
      return { details, history: history.rows }
    },
    [employeeId],
    { fallbackError: "Couldn't load compensation details." },
  )
  const [editing, setEditing] = useState(false)
  const [payType, setPayType] = useState<PayrollPayType | "">("")
  const [baseRate, setBaseRate] = useState("")
  const [effectiveFrom, setEffectiveFrom] = useState(todayInManila())
  const [minEffectiveDate, setMinEffectiveDate] = useState(todayInManila())
  const [changeReason, setChangeReason] = useState("")
  const [components, setComponents] = useState<ComponentDraft[]>([])
  const [formError, setFormError] = useState("")
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const employee = panel.data?.details.employee
  const current = panel.data?.details.current
  const future = panel.data?.details.future
  const history = panel.data?.history ?? []

  function beginEdit() {
    const source = current ?? future
    const latestStart = panel.data?.history[0]?.effectiveFrom
    const nextAllowed = latestStart ? dayAfter(latestStart) : todayInManila()
    const nextDate =
      nextAllowed > todayInManila() ? nextAllowed : todayInManila()
    setPayType(source?.payType ?? "")
    setBaseRate(source?.baseRate ?? "")
    setEffectiveFrom(nextDate)
    setMinEffectiveDate(nextDate)
    setChangeReason("")
    setComponents(
      source?.components.map(({ type, name, amount }) => ({
        type,
        name,
        amount,
      })) ?? [],
    )
    setFormError("")
    setEditing(true)
  }

  function addComponent(type: CompensationComponentType) {
    setComponents((rows) => [...rows, { type, name: "", amount: "" }])
  }

  function updateComponent(index: number, update: Partial<ComponentDraft>) {
    setComponents((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...update } : row,
      ),
    )
  }

  async function saveVersion() {
    if (!employee || !payType) return
    setPending(true)
    setFormError("")
    try {
      await createPayrollCompensationVersion(employeeId, {
        payType,
        baseRate: baseRate.trim(),
        currency: "PHP",
        effectiveFrom,
        changeReason: changeReason.trim(),
        components,
      })
      sileo.success({ title: "Compensation revision created" })
      setConfirmOpen(false)
      setEditing(false)
      panel.retry()
      onSaved()
    } catch (error) {
      setFormError(
        errorMessage(error, "Couldn't create the compensation revision."),
      )
      setConfirmOpen(false)
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (!payType) {
      setFormError("Choose a pay type before continuing.")
      return
    }
    setConfirmOpen(true)
  }

  return (
    <>
      <SidePanel
        open
        onOpenChange={(open) => {
          if (!open && !pending && !editing) onClose()
        }}
        dismissible={!editing}
        busy={pending}
        className="w-full sm:max-w-[640px]"
      >
        <SidePanelHeader
          title={
            editing
              ? "New compensation version"
              : (employee?.fullName ?? "Employee compensation")
          }
          description={
            employee
              ? `Employee ${employee.employeeId}`
              : "Compensation details and history"
          }
          closeDisabled={pending || editing}
        />
        {panel.loading ? (
          <SidePanelBody>
            <p role="status" className="text-sm text-[#65718a]">
              Loading compensation…
            </p>
          </SidePanelBody>
        ) : panel.error ? (
          <SidePanelBody>
            <Alert variant="text" role="alert">
              {panel.error}
              <button
                type="button"
                className="ml-2 underline"
                onClick={panel.retry}
              >
                Try again
              </button>
            </Alert>
          </SidePanelBody>
        ) : editing && employee ? (
          <Form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <SidePanelBody>
              <p className="m-0 text-xs leading-5 text-[#65718a]">
                This adds a new effective-dated version. Existing compensation
                history remains available.
              </p>
              <SidePanelFieldset
                title="Compensation"
                description={`For ${employee.fullName} · ${employee.employeeId}`}
              >
                <label
                  className="grid gap-1.5 text-xs font-medium"
                  htmlFor="payroll-pay-type"
                >
                  Pay type
                  <Select
                    value={payType}
                    onValueChange={(value) =>
                      setPayType(value as PayrollPayType)
                    }
                  >
                    <SelectTrigger
                      id="payroll-pay-type"
                      aria-label="Pay type"
                      className="h-10"
                    >
                      <SelectValue placeholder="Choose a pay type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="HOURLY">Hourly</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label
                  className="grid gap-1.5 text-xs font-medium"
                  htmlFor="payroll-base-rate"
                >
                  Base rate (PHP)
                  <FormInput
                    id="payroll-base-rate"
                    inputMode="decimal"
                    pattern="(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?"
                    value={baseRate}
                    onChange={(event) => setBaseRate(event.target.value)}
                    required
                    maxLength={13}
                    autoComplete="off"
                  />
                </label>
                <label
                  className="grid gap-1.5 text-xs font-medium"
                  htmlFor="payroll-effective-from"
                >
                  Effective from
                  <DateInput
                    id="payroll-effective-from"
                    min={minEffectiveDate}
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                    required
                  />
                </label>
                <label
                  className="grid gap-1.5 text-xs font-medium sm:col-span-2"
                  htmlFor="payroll-change-reason"
                >
                  Reason for change
                  <FormTextarea
                    id="payroll-change-reason"
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    required
                    minLength={3}
                    maxLength={500}
                    rows={3}
                  />
                </label>
              </SidePanelFieldset>
              <SidePanelFieldset
                title="Recurring allowances and deductions"
                description="Fixed PHP amounts only. Statutory and percentage calculations are not included."
              >
                {components.map((component, index) => (
                  <div
                    key={`${index}-${component.type}`}
                    className="grid gap-2 rounded-lg border border-[#e8ebef] p-3 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_minmax(100px,.8fr)_36px]"
                  >
                    <label
                      className="grid gap-1 text-[11px] font-medium"
                      htmlFor={`component-name-${index}`}
                    >
                      {component.type === "ALLOWANCE"
                        ? "Allowance name"
                        : "Deduction name"}
                      <FormInput
                        id={`component-name-${index}`}
                        value={component.name}
                        onChange={(event) =>
                          updateComponent(index, { name: event.target.value })
                        }
                        required
                        maxLength={80}
                      />
                    </label>
                    <label
                      className="grid gap-1 text-[11px] font-medium"
                      htmlFor={`component-amount-${index}`}
                    >
                      Amount (PHP)
                      <FormInput
                        id={`component-amount-${index}`}
                        inputMode="decimal"
                        pattern="(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?"
                        value={component.amount}
                        onChange={(event) =>
                          updateComponent(index, { amount: event.target.value })
                        }
                        required
                        maxLength={13}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-9 self-end p-0"
                      aria-label={`Remove ${component.name || "component"}`}
                      onClick={() =>
                        setComponents((rows) =>
                          rows.filter((_, rowIndex) => rowIndex !== index),
                        )
                      }
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addComponent("ALLOWANCE")}
                  >
                    <Plus size={14} aria-hidden="true" /> Add allowance
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addComponent("RECURRING_DEDUCTION")}
                  >
                    <Plus size={14} aria-hidden="true" /> Add deduction
                  </Button>
                </div>
              </SidePanelFieldset>
              {formError && (
                <Alert role="alert" variant="text">
                  {formError}
                </Alert>
              )}
            </SidePanelBody>
            <SidePanelFooter>
              <SidePanelButton
                variant="secondary"
                disabled={pending}
                onClick={() => setEditing(false)}
              >
                Cancel
              </SidePanelButton>
              <SidePanelButton type="submit" disabled={pending}>
                {pending ? "Saving…" : "Review revision"}
              </SidePanelButton>
            </SidePanelFooter>
          </Form>
        ) : employee ? (
          <>
            <SidePanelBody>
              <SidePanelSection title="Employee">
                <DetailList>
                  <DetailItem label="Employee ID">
                    {employee.employeeId}
                  </DetailItem>
                  <DetailItem label="Department">
                    {employee.department?.name ?? "—"}
                  </DetailItem>
                  <DetailItem label="Employment type">
                    {employee.employmentType.replaceAll("_", " ").toLowerCase()}
                  </DetailItem>
                  <DetailItem label="Employment status">
                    {employee.status.replaceAll("_", " ").toLowerCase()}
                  </DetailItem>
                </DetailList>
              </SidePanelSection>
              <SidePanelSection
                title="Current compensation"
                action={
                  canManage && employee.status !== "INACTIVE" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={beginEdit}
                    >
                      {current || future
                        ? "Create revision"
                        : "Configure compensation"}
                    </Button>
                  ) : undefined
                }
              >
                {current ? (
                  <DetailList>
                    <DetailItem label="Pay type">
                      {payTypeLabel(current.payType)}
                    </DetailItem>
                    <DetailItem label="Base rate">
                      {formatPayrollMoney(current.baseRate)}
                    </DetailItem>
                    <DetailItem label="Effective dates">
                      {formatDate(current.effectiveFrom)} –{" "}
                      {formatDate(current.effectiveTo)}
                    </DetailItem>
                    <DetailItem label="Change reason">
                      {current.changeReason}
                    </DetailItem>
                  </DetailList>
                ) : (
                  <p className="m-0 text-xs text-[#738096]">
                    No compensation is effective today.
                  </p>
                )}
              </SidePanelSection>
              {future && (
                <SidePanelSection title="Next scheduled revision">
                  <DetailList>
                    <DetailItem label="Effective from">
                      {formatDate(future.effectiveFrom)}
                    </DetailItem>
                    <DetailItem label="Pay type">
                      {payTypeLabel(future.payType)}
                    </DetailItem>
                    <DetailItem label="Base rate">
                      {formatPayrollMoney(future.baseRate)}
                    </DetailItem>
                  </DetailList>
                </SidePanelSection>
              )}
              <SidePanelSection title="Compensation history">
                {history.length === 0 ? (
                  <p className="m-0 text-xs text-[#738096]">
                    No compensation versions yet.
                  </p>
                ) : (
                  <ol className="m-0 grid list-none gap-3 p-0">
                    {history.map((version) => (
                      <CompensationHistoryItem
                        key={version.id}
                        version={version}
                      />
                    ))}
                  </ol>
                )}
              </SidePanelSection>
            </SidePanelBody>
            <SidePanelFooter>
              <SidePanelButton variant="secondary" onClick={onClose}>
                Close
              </SidePanelButton>
            </SidePanelFooter>
          </>
        ) : null}
      </SidePanel>
      <ConfirmationDialog
        open={confirmOpen}
        title="Create this compensation revision?"
        subject={employee?.fullName}
        description="The new rate and recurring components will take effect on the selected date. Previous compensation values remain in history."
        confirmLabel="Create revision"
        pendingLabel="Creating…"
        pending={pending}
        destructive={false}
        error={formError}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void saveVersion()}
      />
    </>
  )
}

function CompensationHistoryItem({
  version,
}: {
  version: CompensationVersion
}) {
  return (
    <li className="rounded-lg border border-[#e8ebef] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold">
          {payTypeLabel(version.payType)} ·{" "}
          {formatPayrollMoney(version.baseRate)}
        </span>
        <Pill tone={version.effectiveTo ? "neutral" : "success"}>
          {formatDate(version.effectiveFrom)}
          {version.effectiveTo
            ? ` – ${formatDate(version.effectiveTo)}`
            : " onward"}
        </Pill>
      </div>
      {version.changeReason && (
        <p className="mt-2 mb-0 text-[11px] text-[#65718a]">
          {version.changeReason}
        </p>
      )}
      {version.components.length > 0 && (
        <ul className="mt-2 mb-0 grid gap-1 pl-4 text-[11px] text-[#65718a]">
          {version.components.map((component) => (
            <li key={component.id ?? `${component.type}-${component.name}`}>
              {component.type === "ALLOWANCE" ? "Allowance" : "Deduction"}:{" "}
              {component.name} · {formatPayrollMoney(component.amount)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
