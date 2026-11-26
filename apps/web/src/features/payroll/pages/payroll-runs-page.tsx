"use client"

import { useState } from "react"
import { CalendarRange, Eye, Plus, Search } from "lucide-react"
import { PageHeader, PageHeaderButton } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { SearchField } from "@/components/ui/search-field"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import { TableSearchStatus } from "@/components/ui/table-search-status"
import { usePaginatedList } from "@/components/ui/use-paginated-list"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { sileo } from "@/lib/toast"
import { formatPayrollDate } from "../model/period-format"
import { listPayrollRuns, type PayrollRun } from "../api/payroll-runs-api"
import {
  type RunFilter,
  type FrequencyFilter,
  approvalColumns,
  compactApprovalColumns,
  payrollRunColumns,
  type PanelMode,
  manilaYear,
  matchesRun,
  approvalMobileHidden,
  submissionFor,
  frequencyLabel,
  runStatusLabel,
  calculationTone,
  calculationStatusLabel,
  formatMoney,
} from "../model/payroll-run-view"
import { PayrollActionPanel } from "../components/payroll-runs/payroll-action-panel"
import { PayrollRunDetailsPanel } from "../components/payroll-runs/payroll-run-details-panel"

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
            fitOptions
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
            fitOptions
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    type="button"
                    onClick={list.retry}
                  >
                    Try again
                  </Button>
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
