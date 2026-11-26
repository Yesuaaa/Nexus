"use client"

import { HoverTooltip } from "@/components/ui/hover-tooltip"

import {
  Banknote,
  CircleAlert,
  ClipboardCheck,
  Wallet,
  Eye,
} from "lucide-react"
import Link from "next/link"
import { useState, type ReactNode } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { FilterSelect } from "@/components/ui/filter-select"
import { KpiCards } from "@/components/ui/kpi-cards"
import { KpiDonutChart } from "@/components/ui/kpi-donut-chart"
import { Pill } from "@/components/ui/pill"
import { Skeleton } from "@/components/ui/skeleton"
import { SidePanelError } from "@/components/ui/side-panel"
import {
  DataTableEmptyRow,
  ResponsiveDataTable,
  ResponsiveDataTableBody,
  ResponsiveDataTableCell,
  ResponsiveDataTableColumnHeader,
  ResponsiveDataTableHeader,
  ResponsiveDataTableRow,
} from "@/components/ui/responsive-data-table"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { humanizeEnum } from "@/lib/format"
import { formatPayrollMoney } from "../model/money"
import { formatPayrollDate } from "../model/period-format"

type Overview = {
  scope: { periods: number; from: string | null; to: string | null }
  approvedNet: string
  approvedRuns: number
  realConfirmedPaid: string
  pendingApprovals: number
  currentExceptions: number
  trend: {
    id: string
    period: string
    gross: string
    deductions: string
    net: string
  }[]
  payoutCounts: Record<string, number>
  exceptionCounts: { category: string; count: number }[]
  attention: {
    id: string
    runId: string
    period: string
    category: string
    status: string
    item: string
  }[]
}

const colors = ["#274b9d", "#537bc6", "#ae671e", "#9e4658", "#708196"]
const payoutLabels: Record<string, string> = {
  SUCCEEDED: "Simulated confirmed",
  PENDING: "Pending",
  FAILED: "Failed",
  BLOCKED: "Blocked",
  NO_PAYMENT: "No payment required",
}
const composition = [
  { key: "gross", label: "Gross Pay", color: colors[0] },
  { key: "deductions", label: "Total Deductions", color: colors[2] },
  { key: "net", label: "Net Pay", color: colors[1] },
] as const

function AnalyticsPanel({
  title,
  loading,
  children,
}: {
  title: string
  loading: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="@container min-w-0 rounded-xl border border-border bg-card p-4"
    >
      <h2 className="m-0 mb-4 text-sm font-semibold">{title}</h2>
      {loading ? <Skeleton className="h-44 w-full" /> : children}
    </section>
  )
}

export function ExpenditureTrend({ periods }: { periods: Overview["trend"] }) {
  const single = periods.length === 1 ? periods[0] : undefined
  if (single) {
    return (
      <div className="grid gap-2">
        <p className="m-0 text-xs text-muted-foreground">{single.period}</p>
        <p className="m-0 text-2xl font-semibold tabular-nums">
          {formatPayrollMoney(single.net)}
        </p>
        <p className="m-0 text-xs text-muted-foreground">
          More approved periods are needed to display a payroll trend.
        </p>
      </div>
    )
  }
  const max = Math.max(...periods.map(({ net }) => Number(net)))
  const points = periods.map(({ net }, index) => ({
    x: 4 + (index * 92) / (periods.length - 1),
    y: 92 - (Number(net) / (max || 1)) * 82,
  }))
  return (
    <figure className="m-0">
      <p className="m-0 text-xs text-muted-foreground tabular-nums">
        {formatPayrollMoney(max.toFixed(2))}
      </p>
      <svg
        role="img"
        aria-label={periods
          .map(({ period, net }) => period + " " + formatPayrollMoney(net))
          .join(", ")}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-36 w-full"
      >
        <path
          d="M4 10H96 M4 51H96 M4 92H96"
          fill="none"
          stroke="currentColor"
          className="text-border"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points.map(({ x, y }) => x + "," + y).join(" ")}
          fill="none"
          stroke={colors[0]}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(({ x, y }, index) => {
          const period = periods[index]!
          const description =
            period.period + " · " + formatPayrollMoney(period.net)
          return (
            <ellipse
              key={period.id}
              cx={x}
              cy={y}
              rx="1.3"
              ry="2"
              fill={colors[0]}
              tabIndex={0}
              aria-label={description}
            >
              <title>{description}</title>
            </ellipse>
          )
        })}
      </svg>
      <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{periods[0]?.period}</span>
        {periods.length > 1 && <span>{periods.at(-1)?.period}</span>}
      </figcaption>
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-1 p-0 text-xs">
        {periods.map(({ id, period, net }) => (
          <li key={id} className="tabular-nums">
            {period} · {formatPayrollMoney(net)}
          </li>
        ))}
      </ul>
    </figure>
  )
}

export function PayrollComposition({
  periods,
}: {
  periods: Overview["trend"]
}) {
  const max = Math.max(
    0,
    ...periods.flatMap((period) =>
      composition.map(({ key }) => Number(period[key])),
    ),
  )
  const multiple = periods.length > 1
  return (
    <>
      {multiple && (
        <ul className="m-0 mb-3 flex list-none flex-wrap gap-3 p-0 text-xs">
          {composition.map(({ key, label, color }) => (
            <li key={key}>
              <span
                aria-hidden
                className="mr-1 inline-block size-2 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {label}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4">
        {periods.map((period) => (
          <div key={period.id} className="grid gap-2">
            <span className="text-xs font-medium">{period.period}</span>
            {composition.map(({ key, label, color }) => (
              <div
                key={key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
              >
                <span className="text-xs">{label}</span>
                <span className="text-xs font-medium tabular-nums">
                  {formatPayrollMoney(period[key])}
                </span>
                <div className="col-span-2 h-2 rounded-full bg-muted">
                  <div
                    role="img"
                    aria-label={label + " " + formatPayrollMoney(period[key])}
                    title={label + " · " + formatPayrollMoney(period[key])}
                    className="h-full rounded-full"
                    style={{
                      width: (Number(period[key]) / (max || 1)) * 100 + "%",
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

const grid =
  "grid min-w-[600px] grid-cols-[2fr_1fr_1fr_1fr_64px] items-center gap-3 px-4"

export function PayrollOverviewPage() {
  const [range, setRange] = useState("6")
  const overview = useAsyncResource(
    (signal) =>
      apiRequest<Overview>("/api/payroll/overview?periods=" + range, {
        signal,
      }),
    [range],
  )
  const data = overview.loading || overview.error ? undefined : overview.data
  const payouts = Object.entries(data?.payoutCounts ?? {}).map(
    ([status, value], index) => ({
      label: payoutLabels[status] ?? humanizeEnum(status),
      value,
      color: colors[index % colors.length]!,
    }),
  )
  const totalPayouts = payouts.reduce((sum, segment) => sum + segment.value, 0)
  const maxExceptions = Math.max(
    1,
    ...(data?.exceptionCounts ?? []).map(({ count }) => count),
  )
  return (
    <main
      className={contentClass + " min-w-0 p-[clamp(16px,2.1vw,32px)]"}
      aria-label="Payroll Overview"
    >
      <PageHeader
        title="Payroll Overview"
        description="Monitor payroll performance, disbursements, and reconciliation activity."
        actions={
          <FilterSelect
            fitOptions
            label="Reporting range"
            value={range}
            onChange={setRange}
            options={["3", "6", "12"].map((value) => ({
              value,
              label: "Latest " + value + " payroll periods",
            }))}
          />
        }
      />
      <div className="mt-5 grid min-w-0 gap-5">
        {overview.error && (
          <SidePanelError message={overview.error} onRetry={overview.retry} />
        )}
        {data?.scope.from && (
          <p className="m-0 text-xs text-muted-foreground">
            {formatPayrollDate(data.scope.from)} –{" "}
            {formatPayrollDate(data.scope.to)} · {data.scope.periods} payroll
            periods with runs
          </p>
        )}
        <KpiCards
          label="Payroll totals"
          pending={overview.loading}
          unavailable={Boolean(overview.error)}
          showCharts={false}
          className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
          metrics={[
            {
              label: "Approved Payroll",
              value: 0,
              formattedValue: formatPayrollMoney(data?.approvedNet),
              description:
                (data?.approvedRuns ?? 0) +
                (data?.approvedRuns === 1 ? " approved run" : " approved runs"),
              icon: Banknote,
              iconClassName: "text-[#274b9d]",
            },
            {
              label: "Confirmed Paid",
              value: 0,
              formattedValue: formatPayrollMoney(data?.realConfirmedPaid),
              description: "Real provider confirmations only",
              icon: Wallet,
              iconClassName: "text-[#274b9d]",
            },
            {
              label: "Pending Approvals",
              value: data?.pendingApprovals ?? 0,
              description: "Runs awaiting a decision",
              icon: ClipboardCheck,
              iconClassName: "text-[#274b9d]",
            },
            {
              label: "Open Exceptions",
              value: data?.currentExceptions ?? 0,
              description: "Current financial discrepancies",
              icon: CircleAlert,
              iconClassName: "text-[#ae671e]",
            },
          ]}
        />
        {(data || overview.loading) && (
          <section
            aria-label="Payroll analytics"
            className="grid min-w-0 items-start gap-4 xl:grid-cols-2"
          >
            <AnalyticsPanel
              title="Payroll Expenditure Trend"
              loading={overview.loading}
            >
              {data?.trend.length ? (
                <ExpenditureTrend periods={data.trend} />
              ) : (
                <EmptyState
                  size="sm"
                  title="No approved payroll data"
                  description="Approved payroll totals will appear here once payroll runs are approved."
                />
              )}
            </AnalyticsPanel>
            <AnalyticsPanel
              title="Payroll Composition"
              loading={overview.loading}
            >
              {data?.trend.length ? (
                <PayrollComposition periods={data.trend} />
              ) : (
                <EmptyState size="sm" title="No approved payroll to compare" />
              )}
            </AnalyticsPanel>
            <AnalyticsPanel
              title="Disbursement Status"
              loading={overview.loading}
            >
              {totalPayouts ? (
                <div className="grid items-center gap-5 @min-[350px]:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="relative justify-self-center">
                    <KpiDonutChart
                      size="dashboard"
                      segments={payouts}
                      label={totalPayouts + " unique payout records"}
                    />
                    <span className="pointer-events-none absolute inset-0 grid place-content-center text-center text-xl font-semibold">
                      {totalPayouts}
                      <span className="text-xs font-normal text-muted-foreground">
                        payouts
                      </span>
                    </span>
                  </div>
                  <ul className="m-0 grid list-none gap-2.5 p-0 text-xs">
                    {payouts.map(({ label, value, color }) => (
                      <li key={label} className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 rounded-sm"
                          style={{ backgroundColor: color }}
                        />
                        <span className="flex-1">{label}</span>
                        <strong className="tabular-nums">{value}</strong>
                      </li>
                    ))}
                  </ul>
                  {Boolean(data?.payoutCounts.BLOCKED) && (
                    <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-muted-foreground @min-[350px]:col-span-2">
                      <Pill tone="warning">
                        {data?.payoutCounts.BLOCKED} blocked
                      </Pill>
                      These payout records have no simulator outcome.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState size="sm" title="No payout records in this range" />
              )}
            </AnalyticsPanel>
            <AnalyticsPanel
              title="Reconciliation Exception Breakdown"
              loading={overview.loading}
            >
              {data?.exceptionCounts.length === 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{humanizeEnum(data.exceptionCounts[0]!.category)}</span>
                  <Pill tone="warning">
                    {data.exceptionCounts[0]!.count} current{" "}
                    {data.exceptionCounts[0]!.count === 1
                      ? "discrepancy"
                      : "discrepancies"}
                  </Pill>
                </div>
              ) : data?.exceptionCounts.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {data.exceptionCounts.map(({ category, count }) => (
                    <li key={category} className="grid gap-1.5">
                      <div className="flex justify-between gap-2 text-xs">
                        <span>{humanizeEnum(category)}</span>
                        <strong>{count}</strong>
                      </div>
                      <div
                        className="h-2 rounded-full bg-muted"
                        title={humanizeEnum(category) + " · " + count}
                      >
                        <div
                          className="h-full rounded-full bg-[#274b9d]"
                          style={{ width: (count / maxExceptions) * 100 + "%" }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  size="sm"
                  title="No current discrepancies"
                  description="No reconciliation discrepancies were detected for the selected reporting scope."
                />
              )}
            </AnalyticsPanel>
          </section>
        )}
        <section aria-label="Items Requiring Attention" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-semibold">
              Items Requiring Attention
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/module/payroll/approvals">Review approvals</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/module/payroll/reconciliation">
                  Open reconciliation
                </Link>
              </Button>
            </div>
          </div>
          {overview.loading ? (
            <Skeleton className="h-28 w-full" />
          ) : data ? (
            <ResponsiveDataTable
              label="Items Requiring Attention"
              className="overflow-x-auto"
            >
              <ResponsiveDataTableHeader rowClassName={grid}>
                {["Item", "Reference", "Category", "Status", "Details"].map(
                  (heading) => (
                    <ResponsiveDataTableColumnHeader
                      key={heading}
                      className={
                        heading === "Details" ? "text-center" : undefined
                      }
                    >
                      {heading}
                    </ResponsiveDataTableColumnHeader>
                  ),
                )}
              </ResponsiveDataTableHeader>
              <ResponsiveDataTableBody>
                {data.attention.length === 0 ? (
                  <DataTableEmptyRow colSpan={5}>
                    No payroll items require attention in this range.
                  </DataTableEmptyRow>
                ) : (
                  data.attention.map((row) => (
                    <ResponsiveDataTableRow
                      key={row.id}
                      variant="directory"
                      className={grid + " py-2 text-xs"}
                    >
                      <ResponsiveDataTableCell>
                        {row.category === "APPROVAL"
                          ? row.item
                          : humanizeEnum(row.item)}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        {row.period}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        {humanizeEnum(row.category)}
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell>
                        <Pill tone="warning">{humanizeEnum(row.status)}</Pill>
                      </ResponsiveDataTableCell>
                      <ResponsiveDataTableCell className="text-center">
                        <Button asChild variant="rowAction" size={null}>
                          <Link
                            href={
                              row.category === "APPROVAL"
                                ? "/module/payroll/approvals"
                                : "/module/payroll/reconciliation?run=" +
                                  encodeURIComponent(row.runId)
                            }
                            aria-label={
                              "View " +
                              humanizeEnum(row.category) +
                              " for " +
                              row.period
                            }
                          >
                            <Eye size={15} aria-hidden />
                            <HoverTooltip>
                              {row.category === "APPROVAL"
                                ? "View payroll approval"
                                : "View reconciliation details"}
                            </HoverTooltip>
                          </Link>
                        </Button>
                      </ResponsiveDataTableCell>
                    </ResponsiveDataTableRow>
                  ))
                )}
              </ResponsiveDataTableBody>
            </ResponsiveDataTable>
          ) : null}
        </section>
      </div>
    </main>
  )
}
