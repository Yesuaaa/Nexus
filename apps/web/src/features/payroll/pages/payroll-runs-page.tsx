"use client"

import { useMemo, useState } from "react"
import {
  CalendarRange,
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
import { FormInput } from "@/components/ui/form-input"
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
import { TablePaginationFooter } from "@/components/ui/table-pagination-footer"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { errorMessage } from "@/lib/error-message"
import { useAsyncResource } from "@/lib/use-async-resource"
import { sileo } from "@/lib/toast"
import {
  calculatePayrollRun,
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

const runColumns =
  "grid grid-cols-[minmax(145px,1.4fr)_minmax(95px,.75fr)_minmax(110px,.8fr)_minmax(130px,1fr)_minmax(92px,.7fr)_minmax(105px,.8fr)_auto] items-center gap-3"
const itemColumns =
  "grid grid-cols-[minmax(130px,1.3fr)_minmax(90px,.8fr)_minmax(105px,.9fr)_minmax(85px,.7fr)_auto] items-center gap-2"

function manilaYear() {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Manila",
      year: "numeric",
    }).format(new Date()),
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
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
  return value === "DRAFT" ? "Draft" : "Calculated"
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

export function PayrollRunsPage() {
  const account = usePortalAccount()
  const canManage = canManagePayroll(account)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<RunFilter>("")
  const [frequency, setFrequency] = useState<FrequencyFilter>("")
  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [panelYear, setPanelYear] = useState(manilaYear())
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const query = search.trim()
  const list = usePaginatedList({
    params: { search: query, status, frequency },
    load: ({ page, signal }) =>
      listPayrollRuns({ page, search: query, status, frequency, signal }),
    rows: (result) => result.rows,
    matches: matchesRun,
    initial: { rows: [], total: 0, page: 1, pageSize: 10 },
    fallbackError: "Couldn't load payroll runs.",
  })

  const hasFilters = Boolean(query || status || frequency)

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
    setPanelMode(null)
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
      aria-label="Payroll Runs"
    >
      <PageHeader
        headingId="payroll-runs-heading"
        title="Payroll Runs"
        description="Create draft payroll calculations and review the source records behind each result."
        actions={
          canManage ? (
            <>
              <PageHeaderButton
                type="button"
                onClick={() => {
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
                  setPanelYear(manilaYear())
                  setPanelMode("create-run")
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Create draft run
              </PageHeaderButton>
            </>
          ) : (
            <Pill tone="neutral">Read only</Pill>
          )
        }
      />

      <section
        aria-label="Payroll run list"
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
          <ResponsiveDataTableHeader>
            <div
              className={`${runColumns} max-[900px]:grid-cols-[minmax(140px,1.3fr)_minmax(95px,.8fr)_minmax(105px,.8fr)_minmax(110px,1fr)_auto]`}
            >
              <ResponsiveDataTableColumnHeader>
                Payroll period
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader>
                Frequency
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader>
                Status
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader>
                Calculation review
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader className="text-right max-[900px]:hidden">
                Known gross
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader className="text-right max-[900px]:hidden">
                Employees
              </ResponsiveDataTableColumnHeader>
              <ResponsiveDataTableColumnHeader className="text-right">
                Details
              </ResponsiveDataTableColumnHeader>
            </div>
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
            ) : list.rows.length === 0 && !list.loading ? (
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
                      !hasFilters && canManage ? (
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
                const calculation = run.latestCalculation
                return (
                  <ResponsiveDataTableRow
                    key={run.id}
                    className={`${runColumns} min-h-[58px] border-b border-[#eceef1] px-4 py-2.5 text-xs last:border-0 max-[900px]:grid-cols-[minmax(140px,1.3fr)_minmax(95px,.8fr)_minmax(105px,.8fr)_minmax(110px,1fr)_auto]`}
                  >
                    <ResponsiveDataTableCell className="min-w-0">
                      <span className="block truncate font-semibold">
                        {run.period.cutoffLabel}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#738096]">
                        {formatDate(run.period.startDate)} –{" "}
                        {formatDate(run.period.endDate)}
                      </span>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell>
                      {frequencyLabel(run.period.frequency)}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell>
                      <Pill tone={run.status === "DRAFT" ? "warning" : "brand"}>
                        {runStatusLabel(run.status)}
                      </Pill>
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="min-w-0">
                      {calculation ? (
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
                    <ResponsiveDataTableCell className="text-right tabular-nums max-[900px]:hidden">
                      {calculation ? formatMoney(calculation.grossTotal) : "—"}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="text-right tabular-nums max-[900px]:hidden">
                      {calculation
                        ? calculation.calculatedItemCount +
                          calculation.reviewItemCount +
                          calculation.blockedItemCount
                        : "—"}
                    </ResponsiveDataTableCell>
                    <ResponsiveDataTableCell className="justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 text-[11px]"
                        aria-label={`View ${run.period.cutoffLabel} payroll run`}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <Eye size={14} aria-hidden="true" /> View
                      </Button>
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
        {list.footer && (
          <TablePaginationFooter
            {...list.footer}
            label="Payroll run pages"
            itemLabel="runs"
            onPageChange={list.setPage}
          />
        )}
      </section>

      <PayrollActionPanel
        key={`${panelMode ?? "closed"}-${panelYear}`}
        mode={panelMode}
        year={panelYear}
        onYearChange={setPanelYear}
        onClose={() => setPanelMode(null)}
        onSwitchToGenerate={() => setPanelMode("generate")}
        onGenerate={onPeriodsGenerated}
        onCreateRun={onRunCreated}
      />
      <PayrollRunDetailsPanel
        runId={selectedRunId}
        canManage={canManage}
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
  const availablePeriods = useMemo(
    () => (periods.data ?? []).filter((period) => period.run === null),
    [periods.data],
  )
  const title =
    mode === "generate" ? "Generate payroll periods" : "Create a draft run"
  const description =
    mode === "generate"
      ? "Add calendar periods from the payroll schedule versions that cover the selected year. Existing periods are kept."
      : "Choose an open period to create its single draft run. The calculation can be reviewed and recalculated later."

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
    if (!selectedPeriodId) {
      setError("Choose a payroll period first.")
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
          <SidePanelHeader title={title} description={description} />
          <SidePanelBody>
            {mode === "generate" ? (
              <Form id="payroll-period-generation" onSubmit={generate}>
                <SidePanelFieldset
                  title="Calendar year"
                  description="Only periods inside configured schedule dates are generated."
                >
                  <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a]">
                    Year
                    <FormInput
                      type="number"
                      min={1900}
                      max={9999}
                      required
                      value={year || ""}
                      onChange={(event) =>
                        onYearChange(Number(event.target.value) || 0)
                      }
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
                      onChange={(event) => {
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
                    <p
                      className="m-0 self-end text-xs text-[#738096]"
                      role="status"
                    >
                      Loading periods…
                    </p>
                  ) : periods.error ? (
                    <div className="sm:col-span-2">
                      <SidePanelError
                        message={periods.error}
                        onRetry={periods.retry}
                      />
                    </div>
                  ) : availablePeriods.length ? (
                    <label className="grid gap-1.5 text-[11px] font-medium text-[#52627a] sm:col-span-2">
                      Period
                      <Select
                        value={selectedPeriodId}
                        onValueChange={setSelectedPeriodId}
                      >
                        <SelectTrigger aria-label="Choose payroll period">
                          <SelectValue placeholder="Choose a period" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePeriods.map((period) => (
                            <SelectItem key={period.id} value={period.id}>
                              {periodOptionLabel(period)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  ) : (
                    <div className="sm:col-span-2">
                      <EmptyState
                        icon={CalendarRange}
                        size="sm"
                        title="No open periods for this year"
                        description="Generate periods from the active payroll schedule before creating a run."
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
                  pending || !selectedPeriodId || availablePeriods.length === 0
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
  return `${period.cutoffLabel} · ${frequencyLabel(period.frequency)} · ${formatDate(period.startDate)}–${formatDate(period.endDate)}`
}

function PayrollRunDetailsPanel({
  runId,
  canManage,
  refreshKey,
  onClose,
  onChanged,
}: {
  runId: string | null
  canManage: boolean
  refreshKey: number
  onClose: () => void
  onChanged: () => void
}) {
  const [itemSearch, setItemSearch] = useState("")
  const [selectedCalculationId, setSelectedCalculationId] = useState("")
  const [selectedItem, setSelectedItem] = useState<PayrollRunItem | null>(null)
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
  const items = usePaginatedList({
    params: {
      search: itemSearch.trim(),
      runId: runId ?? "",
      calculationId: selectedCalculationId,
    },
    load: ({ page, signal }) =>
      runId
        ? listPayrollRunItems(runId, {
            page,
            search: itemSearch.trim(),
            calculationId: selectedCalculationId || undefined,
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
  const selectedRevision = useMemo(
    () =>
      run.data?.calculationHistory.find(
        ({ id }) =>
          id === (selectedCalculationId || run.data?.latestCalculation?.id),
      ) ?? null,
    [run.data, selectedCalculationId],
  )

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
    onClose()
    setSelectedCalculationId("")
    setSelectedItem(null)
    setItemSearch("")
    items.setPage(1)
  }

  const summary = selectedRevision
  const statusTone = summary ? calculationTone(summary.status) : "neutral"

  return (
    <>
      <SidePanel
        open={Boolean(runId)}
        onOpenChange={(open) => !open && closePanel()}
      >
        {runId && (
          <>
            <SidePanelHeader
              title={run.data?.period.cutoffLabel ?? "Payroll run details"}
              description={
                run.data
                  ? `${formatDate(run.data.period.startDate)} – ${formatDate(run.data.period.endDate)} · ${frequencyLabel(run.data.period.frequency)}`
                  : "Review period results and employee calculation details."
              }
              eyebrow="Payroll run"
              meta={
                run.data ? (
                  <Pill
                    tone={run.data.status === "DRAFT" ? "warning" : "brand"}
                  >
                    {runStatusLabel(run.data.status)}
                  </Pill>
                ) : undefined
              }
            />
            <SidePanelBody>
              {run.loading ? (
                <p
                  className="m-0 py-10 text-center text-xs text-[#738096]"
                  role="status"
                >
                  Loading payroll run…
                </p>
              ) : run.error ? (
                <SidePanelError message={run.error} onRetry={run.retry} />
              ) : run.data ? (
                <>
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
                          calculations. Review and blocked results are excluded.
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
                      {canManage && (
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
                        canManage ? (
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
                              calculation.id ===
                              (selectedCalculationId ||
                                run.data?.latestCalculation?.id)
                                ? "brand"
                                : "outline"
                            }
                            size="sm"
                            className="h-8 text-[11px]"
                            onClick={() => {
                              setSelectedCalculationId(calculation.id)
                              setSelectedItem(null)
                              items.setPage(1)
                            }}
                          >
                            Revision {calculation.revision}
                          </Button>
                        ))}
                      </div>
                    </SidePanelSection>
                  )}
                  {summary && (
                    <SidePanelSection
                      title="Employee calculations"
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
                      >
                        <ResponsiveDataTableHeader>
                          <div
                            className={`${itemColumns} max-[560px]:grid-cols-[minmax(100px,1fr)_minmax(80px,.7fr)_auto]`}
                          >
                            <ResponsiveDataTableColumnHeader>
                              Employee
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader>
                              Result
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader className="text-right max-[560px]:hidden">
                              Known net
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader className="text-right max-[800px]:hidden">
                              Gross
                            </ResponsiveDataTableColumnHeader>
                            <ResponsiveDataTableColumnHeader className="text-right">
                              Detail
                            </ResponsiveDataTableColumnHeader>
                          </div>
                        </ResponsiveDataTableHeader>
                        <ResponsiveDataTableBody>
                          {items.error ? (
                            <ResponsiveDataTableRow>
                              <ResponsiveDataTableCell
                                aria-colspan={5}
                                className="p-4 text-xs text-[#a02d42]"
                              >
                                <span role="alert">{items.error}</span>
                              </ResponsiveDataTableCell>
                            </ResponsiveDataTableRow>
                          ) : items.rows.length === 0 && !items.loading ? (
                            <ResponsiveDataTableRow>
                              <ResponsiveDataTableCell
                                aria-colspan={5}
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
                                className={`${itemColumns} min-h-[48px] border-b border-[#eceef1] px-3 py-2 text-[11px] last:border-0 max-[560px]:grid-cols-[minmax(100px,1fr)_minmax(80px,.7fr)_auto]`}
                              >
                                <ResponsiveDataTableCell className="min-w-0">
                                  <span className="block truncate font-semibold">
                                    {item.employeeName}
                                  </span>
                                  <span className="mt-0.5 block text-[10px] text-[#738096]">
                                    {item.employeeNumber}
                                  </span>
                                </ResponsiveDataTableCell>
                                <ResponsiveDataTableCell>
                                  <Pill tone={itemStatusTone(item.status)}>
                                    {itemStatusLabel(item.status)}
                                  </Pill>
                                </ResponsiveDataTableCell>
                                <ResponsiveDataTableCell className="text-right tabular-nums max-[560px]:hidden">
                                  {formatMoney(item.netAmount)}
                                </ResponsiveDataTableCell>
                                <ResponsiveDataTableCell className="text-right tabular-nums max-[800px]:hidden">
                                  {formatMoney(item.grossAmount)}
                                </ResponsiveDataTableCell>
                                <ResponsiveDataTableCell className="justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[10px]"
                                    aria-label={`View ${item.employeeName} calculation`}
                                    onClick={() => setSelectedItem(item)}
                                  >
                                    View
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
                  {selectedItem && <PayrollItemBreakdown item={selectedItem} />}
                </>
              ) : null}
            </SidePanelBody>
            <SidePanelFooter>
              <SidePanelButton variant="secondary" onClick={closePanel}>
                Close
              </SidePanelButton>
            </SidePanelFooter>
          </>
        )}
      </SidePanel>
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
                    {formatDate(version.effectiveFrom)} –{" "}
                    {version.effectiveTo
                      ? formatDate(version.effectiveTo)
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
                      {formatDate(day.workDate)}
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
