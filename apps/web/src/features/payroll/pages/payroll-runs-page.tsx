"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarRange,
  ChevronRight,
  CircleAlert,
  Eye,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { Form } from "@/components/ui/form"
import { FormInput, FormTextarea } from "@/components/ui/form-input"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { MemberRowSkeleton } from "@/components/ui/panel-loading"
import { SearchField } from "@/components/ui/search-field"
import { SidePanelError } from "@/components/ui/side-panel"
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
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import { formatPayrollDate } from "../model/period-format"
import {
  calculatePayrollRun,
  transitionPayrollApproval,
  type PayrollApprovalAction,
  createPayrollRun,
  generatePayrollPeriods,
  getPayrollRun,
  listAllPayrollPeriodsForYear,
  listPayrollRunItems,
  listPayrollRuns,
  type PayrollCalculationStatus,
  type PayrollFrequency,
  type PayrollPeriod,
  type PayrollRun,
  type PayrollRunItem,
  type PayrollRunStatus,
} from "../api/payroll-runs-api"

type PanelMode = "generate" | "create-run" | null
type RunFilter = "" | PayrollRunStatus
type FrequencyFilter = "" | PayrollFrequency

const approvalColumns =
  "grid grid-cols-[minmax(0,22fr)_minmax(0,17fr)_minmax(0,17fr)_minmax(0,10fr)_minmax(0,17fr)_minmax(0,9fr)_minmax(42px,8fr)] items-center gap-3"
const payrollRunColumns =
  "grid grid-cols-[minmax(0,21fr)_minmax(0,11fr)_minmax(0,11fr)_minmax(0,19fr)_minmax(0,15fr)_minmax(0,12fr)_minmax(0,11fr)] items-center gap-3 @max-[760px]:grid-cols-[minmax(0,1.35fr)_minmax(0,.85fr)_minmax(0,1fr)_minmax(0,1.2fr)_48px] @max-[480px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @max-[480px]:gap-2"
const compactApprovalColumns =
  "max-[900px]:grid-cols-[minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.9fr)_minmax(0,1fr)_32px] max-[560px]:grid-cols-[minmax(0,1fr)_minmax(90px,.8fr)_32px]"
const approvalMobileHidden = "max-[560px]:hidden"
const itemColumns =
  "grid grid-cols-[minmax(0,1fr)_76px_96px_96px_32px] items-center gap-2 px-3 @max-[460px]:grid-cols-[minmax(0,1fr)_76px_96px_32px] @max-[320px]:grid-cols-[minmax(0,1fr)_76px_32px]"
const approvalItemColumns =
  "grid min-w-[538px] grid-cols-[minmax(94px,1fr)_repeat(3,minmax(100px,1fr))_68px_40px] items-center gap-1 px-2 text-[11px]"
const approvalAmountCell = "text-right tabular-nums [overflow-wrap:anywhere]"
const itemNetColumn = "@max-[320px]:hidden"
const itemGrossColumn = "@max-[460px]:hidden"

function manilaYear() {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(new Date()),
  )
}

function formatPeriodRange(
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

function formatMoney(value: string | null | undefined) {
  if (value === null || value === undefined) return "—"
  const [whole = "0", fraction = "00"] = value.split(".")
  const sign = whole.startsWith("-") ? "−" : ""
  const absolute = whole.replace(/^-/, "")
  return `₱${sign}${absolute.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`
}

function frequencyLabel(value: PayrollFrequency) {
  return value === "MONTHLY" ? "Monthly" : "Semi-monthly"
}

function runStatusLabel(value: PayrollRunStatus) {
  return {
    DRAFT: "Draft",
    CALCULATED: "Calculated",
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  }[value]
}

function calculationStatusLabel(value: PayrollCalculationStatus) {
  if (value === "COMPLETE") return "No review flags"
  if (value === "BLOCKED") return "Blocked"
  return "Review required"
}

function calculationTone(value: PayrollCalculationStatus) {
  if (value === "COMPLETE") return "success" as const
  if (value === "BLOCKED") return "danger" as const
  return "warning" as const
}

function matchesRun(run: PayrollRun, query: string) {
  return [run.period.cutoffLabel, run.id].some((value) =>
    value.toLowerCase().includes(query),
  )
}

function matchesItem(item: PayrollRunItem, query: string) {
  return [item.employeeName, item.employeeNumber].some((value) =>
    value.toLowerCase().includes(query),
  )
}

function itemStatusLabel(value: PayrollRunItem["status"]) {
  if (value === "CALCULATED") return "Calculated"
  if (value === "BLOCKED") return "Blocked"
  return "Review"
}

function itemStatusTone(value: PayrollRunItem["status"]) {
  if (value === "CALCULATED") return "success" as const
  if (value === "BLOCKED") return "danger" as const
  return "warning" as const
}

function submissionFor(revision: PayrollRun["latestCalculation"]) {
  return revision?.approvalEvents?.find(
    ({ action }) =>
      action === "PAYROLL_SUBMITTED" || action === "PAYROLL_RESUBMITTED",
  )
}

const approvalTimestamp = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
})

export function PayrollRunsPage({
  approvals = false,
}: {
  approvals?: boolean
}) {
  const account = usePortalAccount()
  const canManage = canManagePayroll(account)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<RunFilter>("")
  const [frequency, setFrequency] = useState<FrequencyFilter>("")
  const runColumns = approvals
    ? approvalColumns + " " + compactApprovalColumns
    : payrollRunColumns
  const wideColumn = approvals ? "max-[900px]:hidden" : "@max-[760px]:hidden"
  const runDetailsColumn = "@max-[480px]:col-start-2"
  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [panelYear, setPanelYear] = useState(manilaYear())
  const [returnToCreateAfterGeneration, setReturnToCreateAfterGeneration] =
    useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [approvalRevisionId, setApprovalRevisionId] = useState<string | null>(
    null,
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const query = search.trim()
  const list = usePaginatedList({
    params: { search: query, status, frequency },
    load: ({ page, signal }) =>
      listPayrollRuns({
        page,
        approvals,
        search: query,
        status,
        frequency,
        signal,
      }),
    rows: (result) => result.rows,
    matches: matchesRun,
    initial: { rows: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Couldn't load payroll runs.",
  })

  const hasFilters = Boolean(query || status || frequency)
  const approvalPage =
    approvals && list.hasCurrentData && !list.error ? list.data : null

  function clearFilters() {
    setSearch("")
    setStatus("")
    setFrequency("")
    list.setPage(1)
  }

  function onPeriodsGenerated(result: { createdCount: number; total: number }) {
    sileo.success({
      title: result.createdCount
        ? "Payroll periods added"
        : "Periods are up to date",
      description: result.createdCount
        ? `${result.createdCount} period${result.createdCount === 1 ? "" : "s"} added. Existing periods were kept.`
        : `${result.total} periods already match the schedule.`,
    })
    setPanelMode(returnToCreateAfterGeneration ? "create-run" : null)
    setReturnToCreateAfterGeneration(false)
    setRefreshKey((value) => value + 1)
  }

  function onRunCreated(run: PayrollRun) {
    sileo.success({
      title: "Draft run created",
      description: `${run.period.cutoffLabel} is ready for a draft calculation.`,
    })
    setPanelMode(null)
    setSelectedRunId(run.id)
    list.retry()
  }

  return (
    <main
      className={`${contentClass} min-w-0 p-[clamp(16px,2.1vw,32px)]`}
      aria-label={approvals ? "Payroll Approvals" : "Payroll Runs"}
    >
      <PageHeader
        headingId="payroll-runs-heading"
        title={approvals ? "Payroll Approvals" : "Payroll Runs"}
        description={
          approvals
            ? "Review submitted payroll runs and manage approval decisions."
            : "Create draft payroll calculations and review the source records behind each result."
        }
        actions={
          canManage && !approvals ? (
            <>
              <PageHeaderButton
                type="button"
                onClick={() => {
                  setReturnToCreateAfterGeneration(false)
                  setPanelYear(manilaYear())
                  setPanelMode("generate")
                }}
              >
                <CalendarRange size={15} aria-hidden="true" />
                Generate periods
              </PageHeaderButton>
              <PageHeaderButton
                type="button"
                onClick={() => {
                  setReturnToCreateAfterGeneration(false)
                  setPanelYear(manilaYear())
                  setPanelMode("create-run")
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Create draft run
              </PageHeaderButton>
            </>
          ) : !canManage ? (
            <Pill tone="neutral">Read only</Pill>
          ) : null
        }
      />

      <section
        aria-label={approvals ? "Payroll approval queue" : "Payroll run list"}
        className="@container mt-[18px] min-w-0 max-[767px]:mt-[14px]"
      >
        <div className={`${filterBarClass} pb-4`}>
          <SearchField
            label="Search payroll runs"
            value={search}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value)
              list.setPage(1)
            }}
            placeholder="Search period or run ID…"
          />
          <FilterSelect
            label="Filter by run status"
            value={status}
            options={[
              { value: "", label: "All statuses" },
              { value: "DRAFT", label: "Draft" },
              { value: "CALCULATED", label: "Calculated" },
              { value: "PENDING_APPROVAL", label: "Pending approval" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
            triggerClassName="w-[142px]"
            onChange={(value) => {
              setStatus(value)
              list.setPage(1)
            }}
          />
          <FilterSelect
            label="Filter by frequency"
            value={frequency}
            options={[
              { value: "", label: "All frequencies" },
              { value: "MONTHLY", label: "Monthly" },
              { value: "SEMI_MONTHLY", label: "Semi-monthly" },
            ]}
            triggerClassName="w-[150px]"
            onChange={(value) => {
              setFrequency(value)
              list.setPage(1)
            }}
          />
          {hasFilters && (
            <Button
              variant="outline"
              className="h-[34px] text-xs text-[#244993]"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>

        <ResponsiveDataTable label="Payroll runs" aria-busy={list.loading}>
          <ResponsiveDataTableHeader
            className={approvals ? undefined : "@max-[480px]:sr-only"}
            rowClassName={runColumns}
          >
            <ResponsiveDataTableColumnHeader>
              {approvals ? "Payroll Period" : "Payroll period"}
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader
              className={approvals ? approvalMobileHidden : undefined}
            >
              {approvals ? "Submission" : "Frequency"}
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader>
              Status
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader
              className={
                approvals ? `text-right ${approvalMobileHidden}` : undefined
              }
            >
              {approvals ? "Revisions" : "Calculation review"}
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader
              className={`text-right ${wideColumn}`}
            >
              {approvals ? "Net Pay" : "Known gross"}
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader
              className={`text-right ${wideColumn}`}
            >
              Employees
            </ResponsiveDataTableColumnHeader>
            <ResponsiveDataTableColumnHeader className="text-center">
              Details
            </ResponsiveDataTableColumnHeader>
          </ResponsiveDataTableHeader>
          <ResponsiveDataTableBody className="relative min-w-0">
            {list.error ? (
              <ResponsiveDataTableRow>
                <ResponsiveDataTableCell
                  aria-colspan={7}
                  className="grid min-h-32 place-content-center text-center text-xs"
                >
                  <p className="m-0 text-[#a02d42]" role="alert">
                    {list.error}
                  </p>
                  <button
                    type="button"
                    className="mt-2 cursor-pointer border-0 bg-transparent text-[#244993] underline"
                    onClick={list.retry}
                  >
                    Try again
                  </button>
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ) : list.loading ? (
              <DataTableSkeletonRows
                label="payroll runs"
                rows={3}
                rowClassName={`${runColumns} ${approvals ? "min-h-[58px] px-4 py-2.5" : "min-h-14 px-4 py-3"}`}
                cellClassNames={[
                  "",
                  approvals ? approvalMobileHidden : "",
                  "",
                  approvals ? approvalMobileHidden : "",
                  wideColumn,
                  wideColumn,
                  approvals ? "" : runDetailsColumn,
                ]}
              />
            ) : list.rows.length === 0 ? (
              <ResponsiveDataTableRow>
                <ResponsiveDataTableCell aria-colspan={7} className="p-3">
                  <EmptyState
                    icon={list.previewing ? Search : CalendarRange}
                    size="sm"
                    title={
                      hasFilters ? "No payroll runs match" : "No draft runs yet"
                    }
                    description={
                      hasFilters
                        ? "Adjust the search or filters to see other runs."
                        : "Generate periods from the configured schedule, then create a draft run for one of them."
                    }
                    action={
                      !hasFilters && canManage && !approvals ? (
                        <Button
                          variant="outline"
                          onClick={() => setPanelMode("generate")}
                        >
                          Generate periods
                        </Button>
                      ) : undefined
                    }
                  />
                </ResponsiveDataTableCell>
              </ResponsiveDataTableRow>
            ) : (
              list.rows.map((run) => {
                const calculation = approvals
                  ? (run.calculationHistory.find((revision) =>
                      submissionFor(revision),
                    ) ?? null)
                  : run.latestCalculation
                const submission = submissionFor(calculation)
                return (
                  <ResponsiveDataTableRow
                    key={run.id}
                    variant={approvals ? undefined : "directory"}
                    className={`${runColumns} text-xs ${approvals ? "min-h-[58px] border-b border-[#eceef1] px-4 py-2.5 last:border-0" : ""}`}
                  >
                    <ResponsiveDataTableCell className="min-w-0">
                      <span className="block truncate font-semibold">
                        {run.period.cutoffLabel}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#738096]">
                        {formatPayrollDate(run.period.startDate)} –{" "}
                        {formatPayrollDate(run.period.endDate)}
                      </span>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={approvals ? approvalMobileHidden : undefined}
                    >
                      {approvals
                        ? formatPayrollDate(submission?.createdAt)
                        : frequencyLabel(run.period.frequency)}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell>
                      <Pill tone={run.status === "DRAFT" ? "warning" : "brand"}>
                        {runStatusLabel(run.status)}
                      </Pill>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={`min-w-0 ${approvals ? `text-right tabular-nums ${approvalMobileHidden}` : ""}`}
                    >
                      {approvals ? (
                        (calculation?.revision ?? "-")
                      ) : calculation ? (
                        <div className="grid justify-items-start gap-1">
                          <Pill tone={calculationTone(calculation.status)}>
                            {calculationStatusLabel(calculation.status)}
                          </Pill>
                          <span className="text-[10px] text-[#738096]">
                            {calculation.reviewItemCount} review ·{" "}
                            {calculation.blockedItemCount} blocked
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#738096]">Not calculated</span>
                      )}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={`text-right tabular-nums ${approvals ? "whitespace-nowrap" : ""} ${wideColumn}`}
                    >
                      {formatMoney(
                        approvals
                          ? calculation?.netTotal
                          : calculation?.grossTotal,
                      )}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={`text-right tabular-nums ${wideColumn}`}
                    >
                      {calculation
                        ? calculation.calculatedItemCount +
                          calculation.reviewItemCount +
                          calculation.blockedItemCount
                        : "—"}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell
                      className={
                        approvals
                          ? "flex justify-center"
                          : `flex justify-center @max-[480px]:justify-end ${runDetailsColumn}`
                      }
                    >
                      {approvals ? (
                        <Button
                          type="button"
                          variant="rowAction"
                          size={null}
                          aria-label={`View payroll approval for ${run.period.cutoffLabel}`}
                          onClick={() => {
                            setApprovalRevisionId(calculation?.id ?? null)
                            setSelectedRunId(run.id)
                          }}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <HoverTooltip>View payroll approval</HoverTooltip>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="rowAction"
                          size={null}
                          aria-label={`View ${run.period.cutoffLabel} payroll run`}
                          onClick={() => setSelectedRunId(run.id)}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <HoverTooltip>View payroll run</HoverTooltip>
                        </Button>
                      )}
                    </ResponsiveDataTableCell>
                  </ResponsiveDataTableRow>
                )
              })
            )}
          </ResponsiveDataTableBody>
        </ResponsiveDataTable>
        <TableSearchStatus
          active={
            list.loading && list.previewing && Boolean(list.preview?.length)
          }
          label="payroll runs"
        />
        {approvals && approvalPage ? (
          <TablePaginationFooter
            {...pageRange(
              approvalPage.page,
              approvalPage.pageSize,
              approvalPage.total,
            )}
            page={approvalPage.page}
            total={approvalPage.total}
            totalPages={Math.ceil(approvalPage.total / approvalPage.pageSize)}
            disabled={list.loading}
            hidePaginationWhenSinglePage
            label="Payroll approval pages"
            itemLabel="runs"
            onPageChange={list.setPage}
          />
        ) : !approvals && list.footer ? (
          <TablePaginationFooter
            {...list.footer}
            label="Payroll run pages"
            itemLabel="runs"
            onPageChange={list.setPage}
          />
        ) : null}
      </section>

      <PayrollActionPanel
        key={panelMode ?? "closed"}
        mode={panelMode}
        year={panelYear}
        onYearChange={setPanelYear}
        onClose={() => {
          setPanelMode(null)
          setReturnToCreateAfterGeneration(false)
        }}
        onSwitchToGenerate={() => {
          setReturnToCreateAfterGeneration(true)
          setPanelMode("generate")
        }}
        onGenerate={onPeriodsGenerated}
        onCreateRun={onRunCreated}
      />
      <PayrollRunDetailsPanel
        runId={selectedRunId}
        approvalRevisionId={approvalRevisionId}
        canManage={canManage}
        approvals={approvals}
        refreshKey={refreshKey}
        onClose={() => setSelectedRunId(null)}
        onChanged={() => {
          setRefreshKey((value) => value + 1)
          list.retry()
        }}
      />
    </main>
  )
}

function PayrollActionPanel({
  mode,
  year,
  onYearChange,
  onClose,
  onSwitchToGenerate,
  onGenerate,
  onCreateRun,
}: {
  mode: PanelMode
  year: number
  onYearChange: (year: number) => void
  onClose: () => void
  onSwitchToGenerate: () => void
  onGenerate: (result: { createdCount: number; total: number }) => void
  onCreateRun: (run: PayrollRun) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [selectedPeriodId, setSelectedPeriodId] = useState("")
  const validYear = Number.isInteger(year) && year >= 1900 && year <= 9999
  const periods = useAsyncResource(
    (signal) => listAllPayrollPeriodsForYear(year, signal),
    [year, mode],
    {
      enabled: mode === "create-run" && validYear,
      fallbackError: "Couldn't load payroll periods.",
    },
  )
  const periodsByDate = useMemo(
    () =>
      [...(periods.data ?? [])].sort(
        (first, second) =>
          first.startDate.localeCompare(second.startDate) ||
          first.endDate.localeCompare(second.endDate) ||
          first.id.localeCompare(second.id),
      ),
    [periods.data],
  )
  const availablePeriods = useMemo(
    () => periodsByDate.filter((period) => period.run === null),
    [periodsByDate],
  )
  const periodsReady = validYear && !periods.loading && !periods.error
  const selectedPeriod = periodsReady
    ? availablePeriods.find((period) => period.id === selectedPeriodId)
    : undefined
  const selectedPeriodAvailable = Boolean(selectedPeriod)
  const title =
    mode === "generate" ? "Generate payroll periods" : "Create a Draft Run"
  const description =
    mode === "generate"
      ? "Add calendar periods from the payroll schedule versions that cover the selected year. Existing periods are kept."
      : "Select an eligible payroll period to create a draft payroll run."

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const result = await generatePayrollPeriods(year)
      onGenerate(result)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't generate payroll periods."))
    } finally {
      setPending(false)
    }
  }

  async function createRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedPeriodAvailable) {
      setSelectedPeriodId("")
      setError(
        "That payroll period is no longer available. Choose another period.",
      )
      periods.retry()
      return
    }
    setPending(true)
    setError("")
    try {
      const run = await createPayrollRun(selectedPeriodId)
      onCreateRun(run)
    } catch (reason) {
      setError(errorMessage(reason, "Couldn't create the draft run."))
      periods.retry()
    } finally {
      setPending(false)
    }
  }

  return (
    <SidePanel
      open={mode !== null}
      onOpenChange={(open) => !open && onClose()}
      busy={pending}
    >
      {mode && (
        <>
          <SidePanelHeader
            title={title}
            description={description}
            wrapDescription={mode === "create-run"}
          />
          <SidePanelBody>
            {mode === "generate" ? (
              <Form id="payroll-period-generation" onSubmit={generate}>
                <SidePanelFieldset
                  title="Calendar year"
                  description="Only periods inside configured schedule dates are generated."
                >
                  <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a] sm:col-span-2">
                    Year
                    <FormInput
                      type="number"
                      min={1900}
                      max={9999}
                      required
                      value={year || ""}
                      disabled={pending}
                      onChange={(event) => {
                        setError("")
                        onYearChange(Number(event.target.value) || 0)
                      }}
                      step={1}
                      aria-label="Payroll calendar year"
                    />
                  </label>
                </SidePanelFieldset>
                {error && <Alert>{error}</Alert>}
                <p className="m-0 text-xs leading-5 text-[#65718a]">
                  Monthly schedules create one period per month. Semi-monthly
                  schedules use each configured cutoff. Schedule changes inside
                  a period create clipped, non-overlapping dates.
                </p>
              </Form>
            ) : (
              <Form id="payroll-create-run" onSubmit={createRun}>
                <SidePanelFieldset
                  title="Select a payroll period"
                  description="A period can have one draft run."
                >
                  <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a]">
                    Year
                    <FormInput
                      type="number"
                      min={1900}
                      max={9999}
                      required
                      value={year || ""}
                      disabled={pending}
                      onChange={(event) => {
                        setError("")
                        onYearChange(Number(event.target.value) || 0)
                        setSelectedPeriodId("")
                      }}
                      step={1}
                      aria-label="Payroll period year"
                    />
                  </label>
                  {!validYear ? (
                    <div className="sm:col-span-2">
                      <Alert>
                        Enter a calendar year from 1900 through 9999.
                      </Alert>
                    </div>
                  ) : periods.loading ? (
                    <div
                      className="grid min-w-0 gap-2 sm:col-span-2"
                      aria-busy="true"
                    >
                      <span role="status" className="sr-only">
                        Loading payroll periods…
                      </span>
                      <MemberRowSkeleton className="py-3" />
                      <MemberRowSkeleton className="py-3" />
                      <MemberRowSkeleton className="py-3" />
                    </div>
                  ) : periods.error ? (
                    <div className="sm:col-span-2">
                      <SidePanelError
                        message={periods.error}
                        onRetry={periods.retry}
                      />
                    </div>
                  ) : periods.data?.length === 0 ? (
                    <div className="sm:col-span-2">
                      <EmptyState
                        icon={CalendarRange}
                        size="sm"
                        title="No payroll periods generated"
                        description="Generate payroll periods for the selected year before creating a draft run."
                        action={
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onSwitchToGenerate}
                          >
                            Generate periods for {year}
                          </Button>
                        }
                      />
                    </div>
                  ) : availablePeriods.length === 0 ? (
                    <div className="sm:col-span-2">
                      <EmptyState
                        icon={CalendarRange}
                        size="sm"
                        title="No available periods"
                        description="All generated payroll periods for this year already have associated runs."
                      />
                    </div>
                  ) : (
                    <label className="grid min-w-0 gap-1.5 text-[11px] font-medium text-[#52627a]">
                      Period
                      <Select
                        value={selectedPeriodAvailable ? selectedPeriodId : ""}
                        onValueChange={setSelectedPeriodId}
                        disabled={pending || periods.loading}
                      >
                        <SelectTrigger aria-label="Choose payroll period">
                          <SelectValue placeholder="Choose a period" />
                        </SelectTrigger>
                        <SelectContent maxHeight="roomy">
                          {periodsByDate.map((period) => (
                            <SelectItem
                              key={period.id}
                              value={period.id}
                              disabled={period.run !== null}
                            >
                              {periodOptionLabel(period)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  )}
                  {selectedPeriod && (
                    <SidePanelSection
                      title="Selected period"
                      className="sm:col-span-2"
                    >
                      <DetailList>
                        <DetailItem label="Period">
                          <span className="font-semibold">
                            {periodOptionLabel(selectedPeriod)}
                          </span>
                          <Pill tone="success" className="ml-2">
                            Available
                          </Pill>
                        </DetailItem>
                        <DetailItem label="Frequency">
                          {frequencyLabel(selectedPeriod.frequency)}
                        </DetailItem>
                        <DetailItem label="Period dates">
                          {formatPeriodRange(
                            selectedPeriod.startDate,
                            selectedPeriod.endDate,
                          )}
                        </DetailItem>
                      </DetailList>
                    </SidePanelSection>
                  )}
                </SidePanelFieldset>
                {error && <Alert>{error}</Alert>}
                <p className="m-0 text-xs leading-5 text-[#65718a]">
                  Creating a run only saves a draft. Employee amounts are
                  calculated separately from current compensation and attendance
                  records.
                </p>
              </Form>
            )}
          </SidePanelBody>
          <SidePanelFooter>
            <SidePanelButton
              variant="secondary"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </SidePanelButton>
            {mode === "generate" ? (
              <SidePanelButton
                type="submit"
                form="payroll-period-generation"
                disabled={pending}
              >
                {pending ? "Generating…" : "Generate periods"}
              </SidePanelButton>
            ) : (
              <SidePanelButton
                type="submit"
                form="payroll-create-run"
                disabled={
                  pending ||
                  periods.loading ||
                  !selectedPeriodAvailable ||
                  availablePeriods.length === 0
                }
              >
                {pending ? "Creating…" : "Create draft"}
              </SidePanelButton>
            )}
          </SidePanelFooter>
        </>
      )}
    </SidePanel>
  )
}

function periodOptionLabel(period: PayrollPeriod) {
  const [startYear, startMonth, startDay] = period.startDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  const [endYear, endMonth, endDay] = period.endDate
    .slice(0, 10)
    .split("-")
    .map(Number)
  const lastDayOfMonth = new Date(
    Date.UTC(startYear, startMonth, 0),
  ).getUTCDate()

  if (
    period.frequency === "MONTHLY" &&
    startYear === endYear &&
    startMonth === endMonth &&
    startDay === 1 &&
    endDay === lastDayOfMonth
  ) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(startYear, startMonth - 1, startDay)))
  }

  return formatPeriodRange(period.startDate, period.endDate, "long")
}

function PayrollRunDetailsPanel({
  runId,
  approvalRevisionId,
  canManage,
  approvals,
  refreshKey,
  onClose,
  onChanged,
}: {
  runId: string | null
  approvalRevisionId: string | null
  canManage: boolean
  approvals: boolean
  refreshKey: number
  onClose: () => void
  onChanged: () => void
}) {
  const [approvalAction, setApprovalAction] =
    useState<PayrollApprovalAction | null>(null)
  const [reason, setReason] = useState("")
  const [itemSearch, setItemSearch] = useState("")
  const [selectedCalculationId, setSelectedCalculationId] = useState("")
  const [selectedItem, setSelectedItem] = useState<PayrollRunItem | null>(null)
  const runBodyRef = useRef<HTMLDivElement>(null)
  const breakdownRef = useRef<HTMLDivElement>(null)
  const returnToRun = useRef<{
    button: HTMLButtonElement
    scrollTop: number
  } | null>(null)
  useEffect(() => {
    const body = runBodyRef.current
    if (!body) return
    if (selectedItem) {
      body.scrollTop = 0
      breakdownRef.current?.focus({ preventScroll: true })
    } else if (returnToRun.current) {
      body.scrollTop = returnToRun.current.scrollTop
      returnToRun.current.button.focus({ preventScroll: true })
      returnToRun.current = null
    }
  }, [selectedItem])
  const [confirmRecalculate, setConfirmRecalculate] = useState(false)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState("")
  const run = useAsyncResource(
    (signal) => getPayrollRun(runId ?? "", signal),
    [runId, refreshKey],
    {
      enabled: Boolean(runId),
      fallbackError: "Couldn't load this payroll run.",
    },
  )
  const reviewRevision = approvals
    ? run.data?.calculationHistory.find(
        (revision) =>
          revision.id === approvalRevisionId && submissionFor(revision),
      )
    : null
  const activeRevisionId = approvals
    ? (reviewRevision?.id ?? "")
    : selectedCalculationId
  const items = usePaginatedList({
    params: {
      search: itemSearch.trim(),
      runId: runId ?? "",
      calculationId: activeRevisionId,
    },
    load: ({ page, signal }) =>
      runId && (!approvals || activeRevisionId)
        ? listPayrollRunItems(runId, {
            page,
            search: itemSearch.trim(),
            calculationId: activeRevisionId || undefined,
            signal,
          })
        : Promise.resolve({
            rows: [],
            total: 0,
            page,
            pageSize: 10,
            calculationId: null,
          }),
    rows: (result) => result.rows,
    matches: matchesItem,
    initial: { rows: [], total: 0, page: 1, pageSize: 10, calculationId: null },
    fallbackError: "Couldn't load employee calculations.",
  })
  const { onRowsSettled: settleEmployeeRows } = items
  // Employee rows render directly, so there is no animation to settle.
  useEffect(settleEmployeeRows, [settleEmployeeRows])
  const selectedRevision = useMemo(
    () =>
      (approvals
        ? reviewRevision
        : run.data?.calculationHistory.find(
            ({ id }) =>
              id === (activeRevisionId || run.data?.latestCalculation?.id),
          )) ?? null,
    [approvals, reviewRevision, run.data, activeRevisionId],
  )

  const latest = run.data?.latestCalculation
  const account = usePortalAccount()
  const selfApproval =
    !run.data?.demoSelfApprovalEnabled &&
    (account.id === run.data?.createdBy.id ||
      account.id === selectedRevision?.createdBy?.id)
  const submission = submissionFor(selectedRevision)
  const decision = selectedRevision?.approvalEvents?.find(
    ({ action }) =>
      action === "PAYROLL_APPROVED" || action === "PAYROLL_REJECTED",
  )
  const approvalStatus = decision
    ? runStatusLabel(
        decision.action === "PAYROLL_APPROVED" ? "APPROVED" : "REJECTED",
      )
    : submission
      ? runStatusLabel("PENDING_APPROVAL")
      : "—"
  const canRecalculate =
    canManage &&
    !approvals &&
    run.data?.status !== "PENDING_APPROVAL" &&
    run.data?.status !== "APPROVED"
  const reviewIsCurrent = selectedRevision?.id === latest?.id
  const eligible =
    latest?.status === "COMPLETE" &&
    latest.calculatedItemCount > 0 &&
    !latest.reviewItemCount &&
    !latest.blockedItemCount

  function openApproval(action: PayrollApprovalAction) {
    setActionError("")
    setReason("")
    setApprovalAction(action)
  }

  async function confirmApproval() {
    if (!runId || !selectedRevision || !approvalAction || pending) return
    if (approvalAction === "reject" && reason.trim().length < 5) {
      setActionError("Enter a rejection reason of at least 5 characters.")
      return
    }
    setPending(true)
    setActionError("")
    try {
      await transitionPayrollApproval(
        runId,
        selectedRevision.id,
        approvalAction,
        reason.trim(),
      )
      sileo.success({
        title: {
          submit: "Payroll submitted",
          approve: "Payroll approved",
          reject: "Payroll rejected",
        }[approvalAction],
      })
      setApprovalAction(null)
      onChanged()
    } catch (error) {
      setActionError(errorMessage(error, "Couldn't update payroll approval."))
    } finally {
      setPending(false)
    }
  }

  async function recalculate() {
    if (!runId) return
    setPending(true)
    setActionError("")
    try {
      await calculatePayrollRun(runId)
      setSelectedCalculationId("")
      setSelectedItem(null)
      setConfirmRecalculate(false)
      run.retry()
      items.retry()
      onChanged()
      sileo.success({
        title: "New calculation revision saved",
        description: "Earlier revisions remain available for comparison.",
      })
    } catch (reason) {
      setActionError(errorMessage(reason, "Couldn't recalculate this run."))
    } finally {
      setPending(false)
    }
  }

  function closePanel() {
    returnToRun.current = null
    onClose()
    setSelectedCalculationId("")
    setSelectedItem(null)
    setItemSearch("")
    items.setPage(1)
  }

  const summary = selectedRevision
  const statusTone = summary ? calculationTone(summary.status) : "neutral"
  const employeeColumns = approvals ? approvalItemColumns : itemColumns
  const employeeColumnCount = approvals ? 6 : 5
  const historyEvents =
    run.data?.calculationHistory.flatMap((revision) =>
      (revision.approvalEvents ?? []).map((event) => ({ revision, event })),
    ) ?? []
  const displayedHistoryEvents = approvals
    ? [...historyEvents].sort((left, right) =>
        left.event.createdAt.localeCompare(right.event.createdAt),
      )
    : historyEvents
  const approvalPeriodDescription =
    approvals && run.data && selectedRevision
      ? [
          formatPeriodRange(run.data.period.startDate, run.data.period.endDate),
          frequencyLabel(run.data.period.frequency),
          `Revision ${selectedRevision.revision}`,
        ].join(" · ")
      : null

  return (
    <>
      <SidePanel
        open={Boolean(runId)}
        onOpenChange={(open) => !open && closePanel()}
      >
        {runId && (
          <>
            <SidePanelHeader
              title={
                approvals
                  ? "Approval Details"
                  : (run.data?.period.cutoffLabel ?? "Payroll run details")
              }
              description={
                run.data
                  ? approvals
                    ? (approvalPeriodDescription ??
                      "Review the submitted payroll revision.")
                    : `${formatPayrollDate(run.data.period.startDate)} – ${formatPayrollDate(run.data.period.endDate)} · ${frequencyLabel(run.data.period.frequency)}`
                  : approvals
                    ? "Review the submitted payroll revision."
                    : "Review period results and employee calculation details."
              }
              eyebrow={approvals ? undefined : "Payroll run"}
              meta={
                run.data ? (
                  <Pill
                    tone={run.data.status === "DRAFT" ? "warning" : "brand"}
                  >
                    {approvals
                      ? approvalStatus
                      : runStatusLabel(run.data.status)}
                  </Pill>
                ) : undefined
              }
            />
            <SidePanelBody ref={runBodyRef}>
              {run.loading ? (
                <div aria-busy="true">
                  <span className="sr-only" role="status">
                    Loading payroll run…
                  </span>
                  <MemberRowSkeleton className="py-3" />
                  <MemberRowSkeleton className="py-3" />
                </div>
              ) : run.error ? (
                <SidePanelError message={run.error} onRetry={run.retry} />
              ) : run.data && approvals && !summary ? (
                <EmptyState title="No submitted revision" size="sm" />
              ) : run.data ? (
                <Tabs
                  className="min-w-0"
                  defaultValue={approvals && summary ? "approval" : "summary"}
                  onValueChange={() => {
                    returnToRun.current = null
                    setSelectedItem(null)
                    if (runBodyRef.current) runBodyRef.current.scrollTop = 0
                  }}
                >
                  <TabsList
                    aria-label={
                      approvals
                        ? "Payroll approval sections"
                        : "Payroll run sections"
                    }
                    variant="underline"
                    className="-mx-6 -mt-5 w-auto max-[560px]:-mx-5"
                  >
                    {!approvals && (
                      <TabsTrigger value="summary" variant="underline">
                        Summary
                      </TabsTrigger>
                    )}
                    <TabsTrigger
                      value="approval"
                      variant="underline"
                      disabled={!summary}
                    >
                      Approval
                    </TabsTrigger>
                    <TabsTrigger
                      value="employees"
                      variant="underline"
                      disabled={!summary}
                    >
                      Employees
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="summary"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    {summary ? (
                      <>
                        <SidePanelSection
                          title="Known calculated amounts"
                          action={
                            <Pill tone={statusTone}>
                              {calculationStatusLabel(summary.status)}
                            </Pill>
                          }
                        >
                          <Alert className="m-0 border-[#e3e8ef] bg-[#f8fafc] text-[#52627a]">
                            Totals include only employees with complete
                            calculations. Review and blocked results are
                            excluded.
                          </Alert>
                          <DetailList>
                            <DetailItem label="Known gross">
                              {formatMoney(summary.grossTotal)}
                            </DetailItem>
                            <DetailItem label="Known deductions">
                              {formatMoney(summary.deductionsTotal)}
                            </DetailItem>
                            <DetailItem label="Known net">
                              {formatMoney(summary.netTotal)}
                            </DetailItem>
                            <DetailItem label="Fully calculated">
                              {summary.calculatedItemCount}
                            </DetailItem>
                            <DetailItem label="Needs review">
                              {summary.reviewItemCount}
                            </DetailItem>
                            <DetailItem label="Blocked">
                              {summary.blockedItemCount}
                            </DetailItem>
                          </DetailList>
                        </SidePanelSection>
                        {canRecalculate && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => setConfirmRecalculate(true)}
                            >
                              <RefreshCw size={14} aria-hidden="true" />{" "}
                              Recalculate
                            </Button>
                            {actionError && (
                              <Alert className="w-full">{actionError}</Alert>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <EmptyState
                        icon={CircleAlert}
                        size="sm"
                        title="This run has not been calculated"
                        description="Create a draft calculation to inspect employee results and warnings."
                        action={
                          canRecalculate ? (
                            <Button
                              onClick={() => void recalculate()}
                              disabled={pending}
                            >
                              {pending ? "Calculating…" : "Calculate draft"}
                            </Button>
                          ) : undefined
                        }
                      />
                    )}
                    {run.data.calculationHistory.length > 1 && (
                      <SidePanelSection title="Calculation history">
                        <div className="flex flex-wrap gap-2">
                          {run.data.calculationHistory.map((calculation) => (
                            <Button
                              key={calculation.id}
                              variant={
                                calculation.id === summary?.id
                                  ? "brand"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                setSelectedCalculationId(calculation.id)
                                items.setPage(1)
                              }}
                            >
                              Revision {calculation.revision}
                            </Button>
                          ))}
                        </div>
                      </SidePanelSection>
                    )}
                  </TabsContent>
                  <TabsContent
                    value="approval"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    {approvals && selectedRevision && (
                      <>
                        <SidePanelSection title="Submission">
                          <DetailList>
                            <DetailItem label="Submitted by">
                              {submission?.actorName ??
                                submission?.actorId ??
                                "—"}
                            </DetailItem>
                            <DetailItem label="Submitted at">
                              {submission
                                ? approvalTimestamp.format(
                                    new Date(submission.createdAt),
                                  )
                                : "—"}
                            </DetailItem>
                            <DetailItem label="Submission ID">
                              <span className="font-mono text-[10px]">
                                {submission?.id ?? "—"}
                              </span>
                            </DetailItem>
                          </DetailList>
                        </SidePanelSection>
                        <SidePanelSection title="Financial summary">
                          <div className="grid gap-2">
                            <div>
                              <p className="m-0 text-[10px] font-semibold tracking-[0.08em] text-[#738096] uppercase">
                                Net pay for approval
                              </p>
                              <p className="m-0 mt-1 text-2xl leading-tight font-semibold tabular-nums">
                                {formatMoney(selectedRevision.netTotal)}
                              </p>
                            </div>
                            <DetailList>
                              <DetailItem label="Gross pay">
                                <span className="tabular-nums">
                                  {formatMoney(selectedRevision.grossTotal)}
                                </span>
                              </DetailItem>
                              <DetailItem label="Deductions">
                                <span className="tabular-nums">
                                  {formatMoney(
                                    selectedRevision.deductionsTotal,
                                  )}
                                </span>
                              </DetailItem>
                            </DetailList>
                          </div>
                        </SidePanelSection>
                      </>
                    )}
                    {selectedRevision && !approvals && (
                      <SidePanelSection title="Approval review">
                        <DetailList>
                          <DetailItem label="Revision">
                            {selectedRevision.revision} · {selectedRevision.id}
                          </DetailItem>
                          <DetailItem label="Prepared by">
                            {run.data.createdBy.fullName ??
                              run.data.createdBy.id}
                          </DetailItem>
                          <DetailItem label="Calculated by">
                            {selectedRevision.createdBy?.fullName ??
                              selectedRevision.createdBy?.id}
                          </DetailItem>
                        </DetailList>
                        {canManage &&
                          run.data.status === "CALCULATED" &&
                          (eligible && reviewIsCurrent ? (
                            <Button
                              size="sm"
                              disabled={pending}
                              onClick={() => openApproval("submit")}
                            >
                              Submit for Approval
                            </Button>
                          ) : (
                            <Alert>
                              {!reviewIsCurrent
                                ? "Select the current revision to submit it."
                                : "Resolve all employee calculation issues before submitting."}
                            </Alert>
                          ))}
                      </SidePanelSection>
                    )}
                    {approvals &&
                      canManage &&
                      run.data.status === "PENDING_APPROVAL" &&
                      !reviewIsCurrent && (
                        <Alert>
                          Select the submitted revision to make a decision.
                        </Alert>
                      )}
                    {approvals &&
                      canManage &&
                      run.data.status === "PENDING_APPROVAL" &&
                      reviewIsCurrent &&
                      selfApproval && (
                        <Alert>
                          The preparer and calculation author cannot approve
                          this revision.
                        </Alert>
                      )}
                    {run.data.calculationHistory.some(
                      (revision) => revision.approvalEvents?.length,
                    ) && (
                      <SidePanelSection title="Approval history">
                        <DetailList>
                          {displayedHistoryEvents.map(({ revision, event }) => {
                            const action = event.action
                              .replace(/^PAYROLL_/, "")
                              .replaceAll("_", " ")
                              .toLowerCase()
                            const actionLabel = approvals
                              ? action.replace(/^./, (character) =>
                                  character.toUpperCase(),
                                )
                              : action
                            return (
                              <DetailItem
                                key={event.id}
                                label={
                                  approvals
                                    ? `Revision ${revision.revision} ${actionLabel}`
                                    : `Revision ${revision.revision} · ${action}`
                                }
                              >
                                <span>
                                  {event.actorName ?? event.actorId} ·{" "}
                                  {approvals
                                    ? approvalTimestamp.format(
                                        new Date(event.createdAt),
                                      )
                                    : formatPayrollDate(event.createdAt)}
                                </span>
                                {event.reason && (
                                  <p className="m-0 mt-1 text-left text-[11px] font-normal text-[#52627a]">
                                    Reason: {event.reason}
                                  </p>
                                )}
                              </DetailItem>
                            )
                          })}
                        </DetailList>
                      </SidePanelSection>
                    )}
                  </TabsContent>
                  <TabsContent
                    value="employees"
                    className="mt-5 gap-5 data-[state=active]:grid"
                  >
                    {selectedItem && (
                      <>
                        <div>
                          <SidePanelButton
                            variant="secondary"
                            onClick={() => setSelectedItem(null)}
                          >
                            Back to employees
                          </SidePanelButton>
                        </div>
                        <div
                          ref={breakdownRef}
                          tabIndex={-1}
                          role="group"
                          aria-label={`${selectedItem.employeeName} calculation breakdown`}
                        >
                          <PayrollItemBreakdown item={selectedItem} />
                        </div>
                      </>
                    )}
                    {summary && (
                      <SidePanelSection
                        title="Employee calculations"
                        className={selectedItem ? "hidden" : undefined}
                        action={
                          <span className="text-[10px] text-[#738096]">
                            Revision {summary.revision}
                          </span>
                        }
                      >
                        <SearchField
                          label="Search employees in this run"
                          value={itemSearch}
                          maxLength={100}
                          onChange={(event) => {
                            setItemSearch(event.target.value)
                            items.setPage(1)
                            setSelectedItem(null)
                          }}
                          placeholder="Search employee…"
                          containerClassName="w-full"
                        />
                        <ResponsiveDataTable
                          label="Employee payroll calculations"
                          aria-busy={items.loading}
                          className={approvals ? "overflow-x-auto" : undefined}
                        >
                          <ResponsiveDataTableHeader
                            rowClassName={employeeColumns}
                          >
                            <ResponsiveDataTableColumnHeader>
                              Employee
                            </ResponsiveDataTableColumnHeader>
                            {approvals ? (
                              <>
                                <ResponsiveDataTableColumnHeader className="text-right">
                                  Gross Pay
                                </ResponsiveDataTableColumnHeader>
                                <ResponsiveDataTableColumnHeader className="text-right">
                                  Deductions
                                </ResponsiveDataTableColumnHeader>
                                <ResponsiveDataTableColumnHeader className="text-right">
                                  Net Pay
                                </ResponsiveDataTableColumnHeader>
                                <ResponsiveDataTableColumnHeader className="text-center">
                                  Status
                                </ResponsiveDataTableColumnHeader>
                              </>
                            ) : (
                              <>
                                <ResponsiveDataTableColumnHeader>
                                  Result
                                </ResponsiveDataTableColumnHeader>
                                <ResponsiveDataTableColumnHeader
                                  className={`text-right ${itemNetColumn}`}
                                >
                                  Known net
                                </ResponsiveDataTableColumnHeader>
                                <ResponsiveDataTableColumnHeader
                                  className={`text-right ${itemGrossColumn}`}
                                >
                                  Gross
                                </ResponsiveDataTableColumnHeader>
                              </>
                            )}
                            <ResponsiveDataTableColumnHeader
                              className={approvals ? "text-center" : undefined}
                            >
                              {approvals ? (
                                "Details"
                              ) : (
                                <span className="sr-only">
                                  Open calculation
                                </span>
                              )}
                            </ResponsiveDataTableColumnHeader>
                          </ResponsiveDataTableHeader>
                          <ResponsiveDataTableBody>
                            {items.error ? (
                              <ResponsiveDataTableRow>
                                <ResponsiveDataTableCell
                                  aria-colspan={employeeColumnCount}
                                  className="p-4 text-xs text-[#a02d42]"
                                >
                                  <span role="alert">{items.error}</span>
                                </ResponsiveDataTableCell>
                              </ResponsiveDataTableRow>
                            ) : items.loading ? (
                              <DataTableSkeletonRows
                                label="employee results"
                                rows={3}
                                rowClassName={`${employeeColumns} min-h-[48px] py-2`}
                                cellClassNames={
                                  approvals
                                    ? [
                                        "",
                                        "text-right",
                                        "text-right",
                                        "text-right",
                                        "text-center",
                                        "text-center",
                                      ]
                                    : [
                                        "",
                                        "",
                                        itemNetColumn,
                                        itemGrossColumn,
                                        "",
                                      ]
                                }
                              />
                            ) : items.rows.length === 0 ? (
                              <ResponsiveDataTableRow>
                                <ResponsiveDataTableCell
                                  aria-colspan={employeeColumnCount}
                                  className="p-3"
                                >
                                  <EmptyState
                                    size="sm"
                                    title="No employee results"
                                    description="No employees were included in this calculation revision."
                                  />
                                </ResponsiveDataTableCell>
                              </ResponsiveDataTableRow>
                            ) : (
                              items.rows.map((item) => (
                                <ResponsiveDataTableRow
                                  key={item.id}
                                  className={`${employeeColumns} min-h-[48px] border-b border-[#eceef1] py-2 text-[11px] last:border-0`}
                                >
                                  <ResponsiveDataTableCell className="min-w-0">
                                    <span
                                      className={
                                        approvals
                                          ? "block font-semibold [overflow-wrap:anywhere]"
                                          : "block truncate font-semibold"
                                      }
                                    >
                                      {item.employeeName}
                                    </span>
                                    <span
                                      className={
                                        approvals
                                          ? "mt-0.5 block text-[10px] text-[#738096] [overflow-wrap:anywhere]"
                                          : "mt-0.5 block text-[10px] text-[#738096]"
                                      }
                                    >
                                      {item.employeeNumber}
                                    </span>
                                  </ResponsiveDataTableCell>
                                  {approvals ? (
                                    <>
                                      <ResponsiveDataTableCell
                                        className={approvalAmountCell}
                                      >
                                        {formatMoney(item.grossAmount)}
                                      </ResponsiveDataTableCell>
                                      <ResponsiveDataTableCell
                                        className={approvalAmountCell}
                                      >
                                        {formatMoney(item.deductionsAmount)}
                                      </ResponsiveDataTableCell>
                                      <ResponsiveDataTableCell
                                        className={approvalAmountCell}
                                      >
                                        {formatMoney(item.netAmount)}
                                      </ResponsiveDataTableCell>
                                      <ResponsiveDataTableCell className="text-center">
                                        <Pill
                                          tone={itemStatusTone(item.status)}
                                        >
                                          {itemStatusLabel(item.status)}
                                        </Pill>
                                      </ResponsiveDataTableCell>
                                    </>
                                  ) : (
                                    <>
                                      <ResponsiveDataTableCell>
                                        <Pill
                                          tone={itemStatusTone(item.status)}
                                        >
                                          {itemStatusLabel(item.status)}
                                        </Pill>
                                      </ResponsiveDataTableCell>
                                      <ResponsiveDataTableCell
                                        className={`text-right tabular-nums ${itemNetColumn}`}
                                      >
                                        {formatMoney(item.netAmount)}
                                      </ResponsiveDataTableCell>
                                      <ResponsiveDataTableCell
                                        className={`text-right tabular-nums ${itemGrossColumn}`}
                                      >
                                        {formatMoney(item.grossAmount)}
                                      </ResponsiveDataTableCell>
                                    </>
                                  )}
                                  <ResponsiveDataTableCell
                                    className={
                                      approvals
                                        ? "flex justify-center"
                                        : undefined
                                    }
                                  >
                                    <Button
                                      type="button"
                                      variant="rowAction"
                                      size={null}
                                      aria-label={
                                        approvals
                                          ? `View employee calculation details for ${item.employeeName}`
                                          : `View ${item.employeeName} calculation`
                                      }
                                      onClick={(event) => {
                                        returnToRun.current = {
                                          button: event.currentTarget,
                                          scrollTop:
                                            runBodyRef.current?.scrollTop ?? 0,
                                        }
                                        setSelectedItem(item)
                                      }}
                                    >
                                      {approvals ? (
                                        <>
                                          <Eye size={15} aria-hidden="true" />
                                          <HoverTooltip side="top-end">
                                            View employee calculation details
                                          </HoverTooltip>
                                        </>
                                      ) : (
                                        <ChevronRight
                                          size={15}
                                          aria-hidden="true"
                                        />
                                      )}
                                    </Button>
                                  </ResponsiveDataTableCell>
                                </ResponsiveDataTableRow>
                              ))
                            )}
                          </ResponsiveDataTableBody>
                        </ResponsiveDataTable>
                        {items.footer && (
                          <TablePaginationFooter
                            {...items.footer}
                            label="Employee calculation pages"
                            itemLabel="employees"
                            onPageChange={items.setPage}
                          />
                        )}
                      </SidePanelSection>
                    )}
                  </TabsContent>
                </Tabs>
              ) : null}
            </SidePanelBody>
            <SidePanelFooter
              className={approvals ? "justify-between" : undefined}
            >
              <SidePanelButton variant="secondary" onClick={closePanel}>
                Close
              </SidePanelButton>
              {approvals &&
                canManage &&
                run.data?.status === "PENDING_APPROVAL" &&
                reviewIsCurrent && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <SidePanelButton
                      variant="danger"
                      disabled={pending}
                      onClick={() => openApproval("reject")}
                    >
                      Reject
                    </SidePanelButton>
                    {!selfApproval && (
                      <SidePanelButton
                        disabled={pending || !eligible}
                        onClick={() => openApproval("approve")}
                      >
                        Approve
                      </SidePanelButton>
                    )}
                  </div>
                )}
            </SidePanelFooter>
          </>
        )}
      </SidePanel>
      {approvalAction && (
        <ConfirmationDialog
          title={
            {
              submit: "Submit payroll for approval?",
              approve: "Approve this payroll revision?",
              reject: "Reject this payroll revision?",
            }[approvalAction]
          }
          subject={run.data?.period.cutoffLabel}
          description={
            approvalAction === "reject"
              ? "The submitted revision and reason will be kept in the approval history."
              : "This decision applies to the selected calculation revision."
          }
          confirmLabel={
            { submit: "Submit", approve: "Approve", reject: "Reject" }[
              approvalAction
            ]
          }
          pendingLabel="Saving…"
          pending={pending}
          destructive={approvalAction === "reject"}
          error={actionError}
          onClose={() => setApprovalAction(null)}
          onConfirm={() => void confirmApproval()}
        >
          {approvalAction === "reject" && (
            <label className="mt-4 grid gap-2 text-sm">
              Rejection reason
              <FormTextarea
                value={reason}
                required
                maxLength={500}
                minLength={5}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
        </ConfirmationDialog>
      )}
      {confirmRecalculate && (
        <ConfirmationDialog
          title="Recalculate this draft run?"
          subject={run.data?.period.cutoffLabel}
          description="This saves a new revision from the current compensation and attendance records. Earlier revisions stay available, and review or blocked employees remain outside the known totals."
          confirmLabel="Recalculate"
          pendingLabel="Recalculating…"
          pending={pending}
          destructive={false}
          error={actionError}
          onClose={() => setConfirmRecalculate(false)}
          onConfirm={() => void recalculate()}
        />
      )}
    </>
  )
}

function PayrollItemBreakdown({ item }: { item: PayrollRunItem }) {
  const expectedCount = item.attendanceSnapshot.expectedWorkdays.length
  const recordedCount = item.attendanceSnapshot.workdays.length
  return (
    <SidePanelSection title={`${item.employeeName} · calculation breakdown`}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={itemStatusTone(item.status)}>
          {itemStatusLabel(item.status)}
        </Pill>
        <span className="text-[10px] text-[#738096]">
          {item.employeeNumber} · {item.employmentType.replaceAll("_", " ")}
        </span>
      </div>
      <DetailList>
        <DetailItem label="Known gross">
          {formatMoney(item.grossAmount)}
        </DetailItem>
        <DetailItem label="Known deductions">
          {formatMoney(item.deductionsAmount)}
        </DetailItem>
        <DetailItem label="Known net">{formatMoney(item.netAmount)}</DetailItem>
        <DetailItem label="Compensation versions">
          {item.compensationSnapshot.length}
        </DetailItem>
        <DetailItem label="Scheduled workdays">{expectedCount}</DetailItem>
        <DetailItem label="Recorded workdays">{recordedCount}</DetailItem>
      </DetailList>
      {item.blocks.length > 0 && (
        <div className="grid gap-2">
          <h4 className="m-0 text-xs font-semibold text-[#a02d42]">
            Calculation blocked
          </h4>
          {item.blocks.map((block, index) => (
            <Alert key={`${block.code}-${block.reference ?? index}`}>
              {block.message}
            </Alert>
          ))}
        </div>
      )}
      {item.warnings.length > 0 && (
        <div className="grid gap-2">
          <h4 className="m-0 text-xs font-semibold">Review warnings</h4>
          {item.warnings.map((warning, index) => (
            <Alert
              key={`${warning.code}-${warning.reference ?? index}`}
              className="border-[#e3e8ef] bg-[#f8fafc] text-[#52627a]"
            >
              {warning.message}
            </Alert>
          ))}
        </div>
      )}
      <div className="grid gap-3">
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">
            Compensation snapshots
          </h4>
          {item.compensationSnapshot.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {item.compensationSnapshot.map((version) => (
                <li
                  key={version.id}
                  className="rounded-lg border border-[#e8ebef] p-3 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {version.payType.replaceAll("_", " ")} ·{" "}
                      {formatMoney(version.baseRate)}
                    </span>
                    <Pill tone="neutral">{version.id}</Pill>
                  </div>
                  <p className="mb-0 mt-1 text-[10px] text-[#738096]">
                    {formatPayrollDate(version.effectiveFrom)} –{" "}
                    {version.effectiveTo
                      ? formatPayrollDate(version.effectiveTo)
                      : "No end date"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No compensation version was recorded.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">Calculation lines</h4>
          {item.components.length ? (
            <ul className="m-0 grid list-none divide-y divide-[#eceef1] rounded-lg border border-[#e8ebef] px-3 p-0">
              {item.components.map((component) => (
                <li
                  key={component.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[11px]"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{component.name}</span>
                    <span className="text-[10px] text-[#738096]">
                      {component.componentType.replaceAll("_", " ")}
                      {component.sourceId
                        ? ` · source ${component.sourceId}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex-none font-semibold tabular-nums">
                    {component.amount === null
                      ? "Unresolved"
                      : formatMoney(component.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No calculation lines were produced.
            </p>
          )}
        </div>
        <div>
          <h4 className="mb-2 mt-0 text-xs font-semibold">Attendance inputs</h4>
          {item.attendanceSnapshot.workdays.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {item.attendanceSnapshot.workdays.map((day) => (
                <li
                  key={day.id}
                  className="rounded-lg border border-[#e8ebef] p-3 text-[11px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {formatPayrollDate(day.workDate)}
                    </span>
                    <span className="text-[10px] text-[#738096]">
                      {day.sessions.length} session
                      {day.sessions.length === 1 ? "" : "s"} ·{" "}
                      {day.requiredMinutes} scheduled minutes
                    </span>
                  </div>
                  {day.sessions.map((session) => (
                    <p
                      key={session.id}
                      className="m-0 mt-1 break-all text-[10px] text-[#738096]"
                    >
                      {session.startedAt} – {session.endedAt ?? "Still open"}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-xs text-[#738096]">
              No attendance workdays were recorded.
            </p>
          )}
          {item.attendanceSnapshot.overtimeAdjustments.length > 0 && (
            <p className="mb-0 mt-2 text-[10px] text-[#738096]">
              {item.attendanceSnapshot.overtimeAdjustments.length} overtime
              adjustment
              {item.attendanceSnapshot.overtimeAdjustments.length === 1
                ? ""
                : "s"}{" "}
              recorded. Overtime has no configured multiplier and is not
              included in amounts.
            </p>
          )}
        </div>
      </div>
    </SidePanelSection>
  )
}
