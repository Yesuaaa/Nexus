"use client"

import { useState } from "react"
import { Banknote, CircleDollarSign, Clock3, Receipt } from "lucide-react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { DateInput } from "@/components/ui/date-input"
import { FilterSelect } from "@/components/ui/filter-select"
import { SearchField } from "@/components/ui/search-field"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { KpiCards } from "@/components/ui/kpi-cards"
import { OverviewPanel, InlineBar } from "@/components/ui/overview-panel"
import { MonthlyComparison } from "@/components/ui/overview-charts"
import { Skeleton } from "@/components/ui/skeleton"
import { Pill } from "@/components/ui/pill"
import {
  TablePaginationFooter,
  pageRange,
} from "@/components/ui/table-pagination-footer"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

type Dashboard = {
  metrics: {
    label: string
    value: string
    description: string
    money: boolean
  }[]
  chartTitle: string
  breakdownTitle: string
  series: [string, string]
  aging: { label: string; value: string }[]
  columns: string[]
  rows: { id: string; cells: string[]; status?: string }[]
  breakdown: { label: string; value: string }[]
  chart: { label: string; first: string; second: string }[]
}
const kinds: Record<string, string> = {
  Revenue: "revenue",
  Collections: "collections",
  Receivables: "receivables",
  "Expense Summary": "expense-summary",
}
const formatMoney = (value: string) =>
  `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const stamp = (date: Date) => date.toISOString().slice(0, 10)
function periodRange(period: string) {
  const today = new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) +
      "T00:00:00Z",
  )
  const year = today.getUTCFullYear(),
    month = today.getUTCMonth()
  const first = (offset: number) => new Date(Date.UTC(year, month + offset, 1))
  if (period === "last-month")
    return {
      from: stamp(first(-1)),
      to: stamp(new Date(first(0).getTime() - 86400000)),
    }
  if (period === "year")
    return { from: stamp(new Date(Date.UTC(year, 0, 1))), to: stamp(today) }
  return {
    from: stamp(
      first(period === "3-months" ? -2 : period === "6-months" ? -5 : 0),
    ),
    to: stamp(today),
  }
}
const icons = [Receipt, Banknote, CircleDollarSign, Clock3]
const amountColumns = new Set([
  "Billed",
  "Collected",
  "Outstanding",
  "Amount",
  "Invoice Total",
])
export function BillingReport({ title }: { title: string }) {
  const [period, setPeriod] = useState("6-months")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const range =
    period === "custom"
      ? { from: customFrom, to: customTo }
      : periodRange(period)
  const result = useAsyncResource(
    (signal) =>
      apiRequest<Dashboard>(
        `/api/billing/reports/${kinds[title]}/dashboard?${new URLSearchParams(range)}`,
        { signal },
      ),
    [title, range.from, range.to],
    { fallbackError: "Couldn't load the report." },
  )
  const data = result.data
  const filtered =
    data?.rows.filter((row) =>
      row.cells.join(" ").toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  const pageSize = 10
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  )
  const shown = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const chartHasData = data?.chart.some(
    (row) => Number(row.first) || Number(row.second),
  )
  const distribution = data?.aging.length ? data.aging : (data?.breakdown ?? [])
  const maxBreakdown = Math.max(
    0,
    ...distribution.map((row) => Number(row.value)),
  )
  return (
    <section className="mt-5 grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Reporting period"
          value={period}
          onChange={(value) => {
            setPeriod(value)
            setPage(1)
          }}
          options={[
            { value: "month", label: "This Month" },
            { value: "last-month", label: "Last Month" },
            { value: "3-months", label: "Last 3 Months" },
            { value: "6-months", label: "Last 6 Months" },
            { value: "year", label: "This Year" },
            { value: "custom", label: "Custom Range" },
          ]}
        />
        {period === "custom" && (
          <>
            <div>
              <label
                className="block text-xs text-[#65718a]"
                htmlFor="report-from"
              >
                From
              </label>
              <DateInput
                id="report-from"
                value={customFrom}
                onChange={(event) => {
                  setCustomFrom(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label
                className="block text-xs text-[#65718a]"
                htmlFor="report-to"
              >
                To
              </label>
              <DateInput
                id="report-to"
                value={customTo}
                onChange={(event) => {
                  setCustomTo(event.target.value)
                  setPage(1)
                }}
              />
            </div>
          </>
        )}
        <p className="m-0 text-xs text-[#65718a]">
          {title === "Receivables"
            ? "Filter by invoice due date; balances are current."
            : title === "Revenue"
              ? "Invoices by issue date; collections by payment date. Invoice balances are current."
              : "Filter by transaction date."}
        </p>
      </div>
      {result.loading ? (
        <div role="status" aria-label="Loading report" className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-60" />
          <Skeleton className="h-48" />
        </div>
      ) : result.error || !data ? (
        <div>
          <Alert>{result.error || "Couldn't load the report."}</Alert>
          <Button variant="outline" size="sm" onClick={result.retry}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <KpiCards
            label={`${title} summary`}
            metrics={data.metrics.map((metric, index) => ({
              label: metric.label,
              value: 0,
              formattedValue: metric.money
                ? formatMoney(metric.value)
                : metric.value,
              description: metric.description,
              icon: icons[index % icons.length],
              iconClassName: "text-[#274b9d]",
            }))}
            pending={false}
            unavailable={false}
            showCharts={false}
            variant="compact"
            className="grid-cols-2 lg:grid-cols-4 max-[380px]:grid-cols-1"
          />
          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <OverviewPanel
              title={data.chartTitle}
              variant="compact"
              description={
                data.aging.length
                  ? "Days past due; current balances included in 0–30 days"
                  : "Monthly totals for the selected period"
              }
              className="lg:col-span-2"
            >
              {data.aging.length &&
              data.aging.some((row) => Number(row.value)) ? (
                <div className="grid gap-4">
                  {data.aging.map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span>{row.label}</span>
                        <strong>{formatMoney(row.value)}</strong>
                      </div>
                      <InlineBar
                        label={`${row.label}: ${formatMoney(row.value)}`}
                        value={Number(row.value)}
                        max={maxBreakdown}
                      />
                    </div>
                  ))}
                </div>
              ) : data.aging.length ? (
                <EmptyState
                  title="No receivables in this period"
                  description="Try selecting a broader reporting range."
                />
              ) : chartHasData ? (
                <MonthlyComparison
                  series={data.series}
                  rows={data.chart.map((row) => ({
                    label: row.label,
                    first: Number(row.first),
                    second: Number(row.second),
                  }))}
                />
              ) : (
                <EmptyState
                  title="No activity in this period"
                  description="Try selecting a broader reporting range."
                />
              )}
            </OverviewPanel>
            <OverviewPanel title={data.breakdownTitle} variant="compact">
              {data.breakdown.some((row) => Number(row.value)) ? (
                <div className="grid gap-4">
                  {data.breakdown.slice(0, 8).map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span className="min-w-0 break-words">{row.label}</span>
                        <strong className="shrink-0 tabular-nums">
                          {formatMoney(row.value)}
                        </strong>
                      </div>
                      <InlineBar
                        label={`${row.label}: ${formatMoney(row.value)}`}
                        value={Number(row.value)}
                        max={Math.max(
                          ...data.breakdown.map((entry) => Number(entry.value)),
                        )}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No breakdown available"
                  description="Records in this period will appear here."
                />
              )}
            </OverviewPanel>
          </div>
          <OverviewPanel
            title="Detailed Report"
            description="Search the records in the selected period"
            variant="compact"
          >
            <div className="mb-3">
              <SearchField
                label="Search report records"
                placeholder="Search records"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            {shown.length ? (
              <>
                <Table density="compact" aria-label={`${title} report`}>
                  <TableHeader>
                    <TableRow>
                      {data.columns.map((column) => (
                        <TableHead key={column}>{column}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell, index) => (
                          <TableCell key={data.columns[index]}>
                            {data.columns[index] === "Status" ||
                            data.columns[index] === "Allocation" ? (
                              <Pill
                                tone={cell === "OVERDUE" ? "warning" : "brand"}
                              >
                                {cell.replaceAll("_", " ")}
                              </Pill>
                            ) : amountColumns.has(data.columns[index]) ? (
                              formatMoney(cell)
                            ) : (
                              cell
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationFooter
                  {...pageRange(safePage, pageSize, filtered.length)}
                  total={filtered.length}
                  page={safePage}
                  totalPages={Math.ceil(filtered.length / pageSize)}
                  label="Report pages"
                  onPageChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                title="No report records"
                description={
                  search
                    ? "Try a different search."
                    : "Try selecting a broader reporting range."
                }
              />
            )}
          </OverviewPanel>
        </>
      )}
    </section>
  )
}
