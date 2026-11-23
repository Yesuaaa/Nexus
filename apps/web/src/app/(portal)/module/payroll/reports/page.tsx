"use client"

import { HoverTooltip } from "@/components/ui/hover-tooltip"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  Banknote,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect, filterBarClass } from "@/components/ui/filter-select"
import { DateInput } from "@/components/ui/date-input"
import { KpiCards } from "@/components/ui/kpi-cards"
import { DataTableSkeletonRows } from "@/components/ui/data-table-skeleton"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { Pill } from "@/components/ui/pill"
import {
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { SearchField } from "@/components/ui/search-field"
import {
  SidePanelError,
  DetailList,
  DetailItem,
  SidePanel,
  SidePanelHeader,
  SidePanelBody,
  SidePanelFooter,
  SidePanelButton,
} from "@/components/ui/side-panel"
import {
  pageRange,
  TablePaginationFooter,
} from "@/components/ui/table-pagination-footer"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useTableSearchQuery } from "@/components/ui/use-table-search-query"
import {
  apiRequest,
  downloadAuthenticatedFile,
} from "@/features/auth/api/auth-api"
import { canManagePayroll } from "@/features/auth/model/permissions"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import {
  ExpenditureTrend,
  PayrollComposition,
} from "@/features/payroll/pages/payroll-overview-page"
import { formatPayrollMoney } from "@/features/payroll/model/money"
import { formatPayrollDate } from "@/features/payroll/model/period-format"
import { formatDateTime, humanizeEnum } from "@/lib/format"
import { errorMessage } from "@/lib/error-message"
import { sileo } from "@/lib/toast"
import { useAsyncResource } from "@/lib/use-async-resource"

const categories = {
  summary: "Payroll Summary",
  compensation: "Compensation & Deductions",
  disbursements: "Disbursements",
  reconciliation: "Reconciliation",
}
type Category = keyof typeof categories
type Row = { id: string; targetId: string; cells: string[] }
type Report = {
  trend?: {
    id: string
    period: string
    gross: string
    deductions: string
    net: string
  }[]
  columns: string[]
  rows: Row[]
  page: number
  pageSize: number
  total: number
  metrics: { label: string; value: string; money?: boolean }[]
  scope: { periods: number; from: string | null; to: string | null }
}
const money = new Set([
  "Gross pay",
  "Deductions",
  "Net pay",
  "Base compensation",
  "Allowances",
  "Expected net pay",
])
const badges = new Set([
  "Payout status",
  "Detection",
  "Review status",
  "Recurrence",
])
const dates = new Set(["Last observed", "Last attempt"])
const payoutSegments = [
  ["Simulated confirmed", "#274b9d"],
  ["Pending", "#537bc6"],
  ["Failed", "#ae671e"],
  ["Blocked", "#9e4658"],
  ["No payment required", "#708196"],
]
const statuses = {
  summary: [],
  compensation: [],
  disbursements: ["SUCCEEDED", "PENDING", "FAILED", "BLOCKED", "NO_PAYMENT"],
  reconciliation: [
    "CURRENT",
    "HISTORICAL",
    "OPEN",
    "UNDER_REVIEW",
    "RESOLVED",
    "DISMISSED",
    "RECURRING",
  ],
}

function display(column: string, value: string) {
  if (money.has(column)) return formatPayrollMoney(value)
  if (dates.has(column) && value) return formatDateTime(value, "Asia/Manila")
  return value || "—"
}

export default function PayrollReportsPage() {
  const manage = canManagePayroll(usePortalAccount())
  const [category, setCategory] = useState<Category>("summary")
  const [periods, setPeriods] = useState("6")
  const [through, setThrough] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Row | null>(null)
  const [exporting, setExporting] = useState(false)
  const { query, pending } = useTableSearchQuery(search)
  const filters = new URLSearchParams({
    category,
    periods,
    through,
    search: query,
    status,
  })
  const resource = useAsyncResource(
    (signal) =>
      apiRequest<Report>("/api/payroll/reports?" + filters + "&page=" + page, {
        signal,
      }),
    [category, periods, through, query, status, page],
  )
  const loading = resource.loading || pending
  const data = loading || resource.error ? undefined : resource.data
  const columnCount = category === "reconciliation" ? 7 : 6
  const grid =
    columnCount === 7
      ? "grid min-w-[940px] grid-cols-[1fr_1.25fr_1fr_.75fr_.85fr_1fr_.7fr_64px] items-center gap-2 px-4"
      : "grid min-w-[780px] grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_64px] items-center gap-2 px-4"
  const segments = payoutSegments.map(([label, color]) => ({
    label: label!,
    color: color!,
    value: Number(
      data?.metrics.find((metric) => metric.label === label)?.value ?? 0,
    ),
  }))
  const exportLock = useRef(false)
  async function exportReport(format: "csv" | "xlsx") {
    if (exportLock.current) return
    exportLock.current = true
    setExporting(true)
    try {
      await downloadAuthenticatedFile(
        "/api/payroll/reports/export?" + filters + "&format=" + format,
        "converyn-payroll-" +
          category +
          "-latest-" +
          periods +
          (through ? "-through-" + through : "") +
          "." +
          format,
      )
    } catch (cause) {
      sileo.error({
        title: errorMessage(cause, "Could not export payroll report"),
      })
    } finally {
      exportLock.current = false
      setExporting(false)
    }
  }
  return (
    <main
      aria-label="Payroll Reports"
      className={contentClass + " min-w-0 p-[clamp(16px,2.1vw,32px)]"}
    >
      <PageHeader
        title="Payroll Reports"
        description="Analyze payroll expenditure, compensation, disbursements, and reconciliation records."
        actions={
          manage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="brand"
                  disabled={exporting || !data?.total || loading}
                  aria-busy={exporting}
                >
                  <Download size={15} aria-hidden />
                  {exporting ? "Exporting…" : "Export Report"}
                  <ChevronDown size={15} aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" variant="compact">
                <DropdownMenuItem
                  variant="compact"
                  onSelect={() => void exportReport("csv")}
                >
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="compact"
                  onSelect={() => void exportReport("xlsx")}
                >
                  Export Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />
      <Tabs
        value={category}
        onValueChange={(value) => {
          if (!Object.hasOwn(categories, value)) return
          setCategory(value as Category)
          setStatus("")
          setPage(1)
          setSelected(null)
        }}
        className="mt-4 min-w-0"
      >
        <TabsList
          variant="underline"
          aria-label="Report categories"
          className="max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-0"
        >
          {Object.entries(categories).map(([value, label]) => (
            <TabsTrigger key={value} value={value} variant="underline">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={category} className="grid min-w-0 gap-4">
          <div className={filterBarClass}>
            <SearchField
              label="Search report"
              placeholder="Search report…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
            <FilterSelect
              fitOptions
              label="Reporting range"
              value={periods}
              options={["3", "6", "12"].map((value) => ({
                value,
                label: "Latest " + value + " payroll periods",
              }))}
              onChange={(value) => {
                setPeriods(value)
                setPage(1)
              }}
            />
            <div className="flex min-w-0 items-center gap-1">
              <DateInput
                aria-label="Periods ending by"
                value={through}
                triggerLabel={
                  through ? formatPayrollDate(through) : "Periods ending by"
                }
                onDateSelect={(value) => {
                  setThrough(value)
                  setPage(1)
                }}
              />
              {through && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Clear cutoff date"
                  onClick={() => {
                    setThrough("")
                    setPage(1)
                  }}
                >
                  <X size={14} aria-hidden />
                </Button>
              )}
            </div>
            {statuses[category].length > 0 && (
              <FilterSelect
                fitOptions
                label="Report status"
                value={status}
                options={[
                  { value: "", label: "All statuses" },
                  ...statuses[category].map((value) => ({
                    value,
                    label:
                      value === "SUCCEEDED"
                        ? "Simulated confirmed"
                        : humanizeEnum(value),
                  })),
                ]}
                onChange={(value) => {
                  setStatus(value)
                  setPage(1)
                }}
              />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPeriods("6")
                setThrough("")
                setSearch("")
                setStatus("")
                setPage(1)
              }}
            >
              Reset filters
            </Button>
          </div>
          {resource.error && (
            <SidePanelError message={resource.error} onRetry={resource.retry} />
          )}
          {data && (
            <p className="m-0 text-xs text-muted-foreground">
              {data.scope.from
                ? formatPayrollDate(data.scope.from) +
                  " – " +
                  formatPayrollDate(data.scope.to) +
                  " · " +
                  data.scope.periods +
                  (data.scope.periods === 1
                    ? " period with a run"
                    : " periods with runs")
                : "No payroll periods match this scope."}
            </p>
          )}
          {data &&
            (category === "disbursements" ? (
              <section
                aria-label="Payout summary"
                className="@container rounded-xl border border-border bg-card p-4"
              >
                <div className="mx-auto grid max-w-2xl items-center gap-5 @min-[420px]:grid-cols-[160px_minmax(0,1fr)]">
                  {segments.some(({ value }) => value > 0) && (
                    <KpiDonutChart
                      label="Filtered payout outcomes"
                      segments={segments}
                      size="dashboard"
                    />
                  )}
                  <dl
                    className={
                      segments.some(({ value }) => value > 0)
                        ? "m-0 grid min-w-0 gap-2.5"
                        : "col-span-full m-0 grid min-w-0 gap-2.5"
                    }
                  >
                    {data.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <dt className="flex items-center gap-2">
                          {segments.find(({ label }) => label === metric.label)
                            ?.color && (
                            <span
                              aria-hidden
                              className="size-2 shrink-0 rounded-sm"
                              style={{
                                backgroundColor: segments.find(
                                  ({ label }) => label === metric.label,
                                )?.color,
                              }}
                            />
                          )}
                          {metric.label}
                        </dt>
                        <dd className="m-0 font-semibold tabular-nums">
                          {metric.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            ) : (
              <KpiCards
                label="Report totals"
                pending={false}
                unavailable={false}
                showCharts={false}
                className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                metrics={data.metrics.map((metric) => ({
                  label: metric.label,
                  value: Number(metric.value),
                  formattedValue: metric.money
                    ? formatPayrollMoney(metric.value)
                    : undefined,
                  icon: metric.money ? Banknote : ClipboardList,
                  iconClassName: "text-[#274b9d]",
                  description:
                    metric.money && !metric.value
                      ? "Unavailable in this scope"
                      : "Selected reporting scope",
                }))}
              />
            ))}
          {Boolean(data?.trend?.length) &&
            (category === "summary" || category === "compensation") && (
              <section
                className="min-w-0 rounded-xl border border-border bg-card p-4"
                aria-label={
                  category === "summary"
                    ? "Payroll Expenditure Trend"
                    : "Payroll Composition"
                }
              >
                <h2 className="m-0 mb-3 text-sm font-semibold">
                  {category === "summary"
                    ? "Payroll Expenditure Trend"
                    : "Payroll Composition"}
                </h2>
                {category === "summary" ? (
                  <ExpenditureTrend periods={data!.trend!} />
                ) : (
                  <PayrollComposition periods={data!.trend!} />
                )}
              </section>
            )}
          {(data || loading) && (
            <ResponsiveDataTable
              label={categories[category]}
              aria-busy={loading}
              className="overflow-x-auto"
            >
              <ResponsiveDataTableHeader rowClassName={grid}>
                {(
                  data?.columns ??
                  Array.from({ length: columnCount }, (_, index) =>
                    index === 0 ? "Payroll period" : "",
                  )
                ).map((column, index) => (
                  <ResponsiveDataTableColumnHeader
                    key={index}
                    className={money.has(column) ? "text-right" : undefined}
                  >
                    {column}
                  </ResponsiveDataTableColumnHeader>
                ))}
                <ResponsiveDataTableColumnHeader className="text-center">
                  Details
                </ResponsiveDataTableColumnHeader>
              </ResponsiveDataTableHeader>
              <ResponsiveDataTableBody>
                {loading ? (
                  <DataTableSkeletonRows
                    label="payroll report"
                    rows={3}
                    rowClassName={grid + " min-h-12"}
                    cellClassNames={Array.from(
                      { length: columnCount + 1 },
                      () => "",
                    )}
                  />
                ) : (
                  data?.rows.map((row) => (
                    <ResponsiveDataTableRow
                      key={row.id}
                      variant="directory"
                      className={grid + " min-h-12 text-xs"}
                    >
                      {data.columns.map((column, index) => (
                        <ResponsiveDataTableCell
                          key={column}
                          className={
                            money.has(column)
                              ? "text-right tabular-nums whitespace-nowrap"
                              : "break-words"
                          }
                        >
                          {badges.has(column) && row.cells[index] ? (
                            <Pill tone="neutral">{row.cells[index]}</Pill>
                          ) : (
                            display(column, row.cells[index] ?? "")
                          )}
                        </ResponsiveDataTableCell>
                      ))}
                      <ResponsiveDataTableCell className="text-center">
                        <Button
                          type="button"
                          size={null}
                          variant="rowAction"
                          aria-label={
                            "View report details for " +
                            row.cells.slice(0, 2).join(" · ")
                          }
                          onClick={() => setSelected(row)}
                        >
                          <Eye size={15} aria-hidden />
                          <HoverTooltip>View report details</HoverTooltip>
                        </Button>
                      </ResponsiveDataTableCell>
                    </ResponsiveDataTableRow>
                  ))
                )}
              </ResponsiveDataTableBody>
            </ResponsiveDataTable>
          )}
          {data?.total === 0 && (
            <EmptyState title="No matching payroll records" size="sm" />
          )}
          {data && data.total > data.pageSize && (
            <TablePaginationFooter
              {...pageRange(data.page, data.pageSize, data.total)}
              total={data.total}
              page={data.page}
              totalPages={Math.ceil(data.total / data.pageSize)}
              label="Payroll report pages"
              onPageChange={setPage}
            />
          )}
          {selected && data && (
            <SidePanel
              open
              onOpenChange={(open) => {
                if (!open) setSelected(null)
              }}
            >
              <SidePanelHeader
                title="Report Details"
                description={categories[category] + " · " + selected.cells[0]}
              />
              <SidePanelBody>
                <DetailList>
                  {data.columns.map((column, index) => (
                    <DetailItem key={column} label={column}>
                      {display(column, selected.cells[index] ?? "")}
                    </DetailItem>
                  ))}
                  <DetailItem label="Record reference">
                    {selected.targetId}
                  </DetailItem>
                </DetailList>
              </SidePanelBody>
              <SidePanelFooter>
                <SidePanelButton
                  type="button"
                  variant="secondary"
                  onClick={() => setSelected(null)}
                >
                  Close
                </SidePanelButton>
                <Button asChild variant="outline">
                  <Link
                    href={
                      category === "reconciliation"
                        ? "/module/payroll/reconciliation?run=" +
                          encodeURIComponent(selected.targetId)
                        : category === "disbursements"
                          ? "/module/payroll/disbursements"
                          : "/module/payroll/runs"
                    }
                  >
                    Open{" "}
                    {category === "reconciliation"
                      ? "Reconciliation"
                      : category === "disbursements"
                        ? "Disbursements"
                        : "Payroll Runs"}
                  </Link>
                </Button>
              </SidePanelFooter>
            </SidePanel>
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
