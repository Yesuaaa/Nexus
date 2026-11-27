"use client"

import { useState } from "react"
import Link from "next/link"
import { Banknote, Receipt, CircleDollarSign, TrendingUp } from "lucide-react"
import { apiRequest } from "@/features/auth/api/auth-api"
import { useAsyncResource } from "@/lib/use-async-resource"
import { KpiCards } from "@/components/ui/kpi-cards"
import { InlineBar, OverviewPanel } from "@/components/ui/overview-panel"
import { MonthlyComparison } from "@/components/ui/overview-charts"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchField } from "@/components/ui/search-field"
import { FilterSelect } from "@/components/ui/filter-select"
import { Pill } from "@/components/ui/pill"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Activity = {
  id: string
  reference: string
  description: string
  type: string
  amount: string
  status: string
  date: string
}
type Overview = {
  totals: {
    invoiced: string
    collected: string
    outstanding: string
    overdue: string
    current: string
    unallocated: string
    expenses: string
    netCollections: string
    monthlyExpenses: string
  }
  aging: string[]
  performance: { month: string; collections: string; expenses: string }[]
  activity: Activity[]
  outstandingInvoices: {
    id: string
    invoiceNumber: string
    clientName: string
    total: string
    outstanding: string
    dueDate: string
    status: string
  }[]
}
const money = (value: string) =>
  `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (value: string, timeZone = "UTC") =>
  new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  })
function Navigation({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  )
}
export function BillingOverview() {
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const resource = useAsyncResource(
    (signal) => apiRequest<Overview>("/api/billing/overview", { signal }),
    [],
    { fallbackError: "Couldn't load the finance overview." },
  )
  if (resource.loading)
    return (
      <div
        role="status"
        aria-label="Loading finance overview"
        className="mt-5 grid gap-4 md:grid-cols-3"
      >
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48 md:col-span-2" />
      </div>
    )
  if (resource.error || !resource.data)
    return (
      <div className="mt-5">
        <Alert>{resource.error || "Couldn't load the finance overview."}</Alert>
        <Button variant="outline" size="sm" onClick={resource.retry}>
          Try again
        </Button>
      </div>
    )
  const data = resource.data
  const metrics = [
    {
      label: "Total Billed",
      formattedValue: money(data.totals.invoiced),
      description: "Issued invoices",
      icon: Receipt,
    },
    {
      label: "Total Collected",
      formattedValue: money(data.totals.collected),
      description: "Recognized collections",
      icon: Banknote,
    },
    {
      label: "Total Expenses",
      formattedValue: money(data.totals.expenses),
      description: "Recorded expenses",
      icon: CircleDollarSign,
    },
    {
      label: "Net Collections",
      formattedValue: money(data.totals.netCollections),
      description: "Collections less expenses",
      icon: TrendingUp,
    },
  ].map((metric) => ({ ...metric, value: 0, iconClassName: "text-[#274b9d]" }))
  const rows = data.activity.filter(
    (row) =>
      (!type || row.type === type) &&
      `${row.reference} ${row.description} ${row.type} ${row.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const agingLabels = ["0–30 days", "31–60 days", "61–90 days", "90+ days"]
  const previousMonth = data.performance.at(-2)
  const agingMax = Math.max(0, ...data.aging.map(Number))
  return (
    <div className="mt-5 grid gap-4">
      <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <OverviewPanel title="Outstanding Receivables" variant="highlight">
          <p className="m-0 text-3xl leading-tight font-medium tracking-tight text-[#101d35] tabular-nums [overflow-wrap:anywhere] max-[380px]:text-2xl">
            {money(data.totals.outstanding)}
          </p>
          <p className="mt-1 text-xs text-[#65718a]">Unpaid issued invoices</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Navigation href="/billing-finance/management/invoices">
              View invoices
            </Navigation>
            <Navigation href="/billing-finance/management/payments">
              View payments
            </Navigation>
          </div>
          <h3 className="mt-4 mb-2 border-t border-[#d9e3f1] pt-3 text-xs font-semibold text-[#101d35]">
            Receivable Breakdown
          </h3>
          <dl className="m-0 grid gap-2 text-xs">
            {[
              ["Current", data.totals.current],
              ["Overdue", data.totals.overdue],
              ["Unallocated collections", data.totals.unallocated],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-[#65718a]">{label}</dt>
                <dd className="m-0 min-w-0 text-right text-[13px] font-semibold tabular-nums [overflow-wrap:anywhere]">
                  {money(value)}
                </dd>
              </div>
            ))}
          </dl>
        </OverviewPanel>
        <KpiCards
          label="Billing performance"
          metrics={metrics}
          pending={false}
          unavailable={false}
          showCharts={false}
          variant="compact"
          className="grid-cols-2 max-[380px]:grid-cols-1"
        />
        <OverviewPanel
          title="Financial Performance"
          description="Collections vs expenses · last six months"
          variant="compact"
          className="md:col-span-2 2xl:col-span-1"
        >
          {data.performance.some(
            (row) => Number(row.collections) || Number(row.expenses),
          ) ? (
            <MonthlyComparison
              series={["Collections", "Expenses"]}
              rows={data.performance.map((row) => ({
                label: new Date(`${row.month}-01T00:00:00Z`).toLocaleDateString(
                  "en-PH",
                  { month: "short", timeZone: "UTC" },
                ),
                first: Number(row.collections),
                second: Number(row.expenses),
              }))}
            />
          ) : (
            <EmptyState
              title="No financial activity yet"
              description="Collections and expenses will appear here."
            />
          )}
        </OverviewPanel>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4">
          <OverviewPanel
            title="Monthly Expenses"
            description="Recorded this month"
            variant="compact"
          >
            <p className="m-0 text-2xl font-semibold tabular-nums [overflow-wrap:anywhere]">
              {money(data.totals.monthlyExpenses)}
            </p>
            {previousMonth && (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#eceef1] pt-3 text-xs">
                <span className="text-[#65718a]">Previous month</span>
                <span className="min-w-0 text-right font-medium tabular-nums [overflow-wrap:anywhere]">
                  {money(previousMonth.expenses)}
                </span>
              </div>
            )}
          </OverviewPanel>
          <OverviewPanel
            title="Receivable Aging"
            variant="compact"
            description="Days past due; current balances included in 0–30 days"
            action={
              <Navigation href="/billing-finance/reports/receivables">
                View receivables
              </Navigation>
            }
          >
            <dl className="m-0 grid gap-2 text-xs">
              {agingLabels.map((label, index) => (
                <div
                  key={label}
                  className="grid grid-cols-[auto_minmax(24px,1fr)_auto] items-center gap-2"
                >
                  <dt className="text-[#65718a]">{label}</dt>
                  <InlineBar
                    value={Number(data.aging[index])}
                    max={agingMax}
                    label={`${label}: ${money(data.aging[index])}`}
                  />
                  <dd className="m-0 min-w-0 text-right text-[13px] font-semibold tabular-nums [overflow-wrap:anywhere]">
                    {money(data.aging[index])}
                  </dd>
                </div>
              ))}
            </dl>
          </OverviewPanel>
        </div>
        <OverviewPanel
          title="Recent Financial Activity"
          description="Most recent 30 records"
          variant="compact"
          className="lg:col-span-2"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <SearchField
              label="Search activity"
              placeholder="Search activity"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <FilterSelect
              label="Filter activity"
              value={type}
              onChange={setType}
              options={[
                { value: "", label: "All activity" },
                ...["Invoice", "Payment", "Commencement", "Expense"].map(
                  (value) => ({ value, label: value }),
                ),
              ]}
            />
          </div>
          {rows.length ? (
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  {[
                    "Reference",
                    "Client / Description",
                    "Type",
                    "Amount",
                    "Status",
                    "Date",
                  ].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.type}-${row.id}`}>
                    <TableCell>{row.reference}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="font-semibold tabular-nums">
                      {money(row.amount)}
                    </TableCell>
                    <TableCell>
                      <Pill>{row.status}</Pill>
                    </TableCell>
                    <TableCell>
                      {day(
                        row.date,
                        row.type === "Commencement" ? "Asia/Manila" : "UTC",
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="No activity found"
              description="Financial activity will appear here."
            />
          )}
        </OverviewPanel>
      </div>
      <OverviewPanel
        title="Outstanding Invoices"
        variant="compact"
        action={
          <Navigation href="/billing-finance/management/invoices">
            View all
          </Navigation>
        }
      >
        {data.outstandingInvoices.length ? (
          <Table density="compact">
            <TableHeader>
              <TableRow>
                {[
                  "Invoice #",
                  "Client",
                  "Due date",
                  "Total",
                  "Outstanding",
                  "Status",
                ].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.outstandingInvoices.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.invoiceNumber}</TableCell>
                  <TableCell>{row.clientName}</TableCell>
                  <TableCell>{day(row.dueDate)}</TableCell>
                  <TableCell>{money(row.total)}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {money(row.outstanding)}
                  </TableCell>
                  <TableCell>
                    <Pill tone={row.status === "OVERDUE" ? "warning" : "brand"}>
                      {row.status.replaceAll("_", " ")}
                    </Pill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No outstanding invoices"
            description="Unpaid invoices will appear here."
          />
        )}
      </OverviewPanel>
    </div>
  )
}
