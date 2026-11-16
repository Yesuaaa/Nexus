"use client"

import { PageHeader } from "@/components/layout/page-header"
import { PageHeaderLink } from "@/components/layout/page-header-link"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { CompositionBar } from "@/components/ui/overview-charts"
import {
  cellClass,
  FiguresRow,
  headCellClass,
  InlineBar,
  RowsSkeleton,
  Section,
  tableClass,
} from "@/components/ui/overview-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  listEmployees,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"
import { employmentTypeOptions } from "../model/employment"

type EmployeeOverview = {
  total: number
  active: number
  onLeave: number
  inactive: number
  archived: number
  types: Record<EmploymentType, number>
}

async function loadOverview(signal: AbortSignal): Promise<EmployeeOverview> {
  // Lightweight list requests (first page only); just the totals are used.
  const count = (
    filters: {
      status?: EmploymentStatus
      employmentType?: EmploymentType
      archived?: boolean
    } = {},
  ) =>
    listEmployees({ ...filters, page: 1, signal }).then(
      (result) => result.total,
    )
  const [total, active, onLeave, inactive, archived, ...typeTotals] =
    await Promise.all([
      count(),
      count({ status: "ACTIVE" }),
      count({ status: "ON_LEAVE" }),
      count({ status: "INACTIVE" }),
      count({ archived: true }),
      ...employmentTypeOptions.map(({ value }) =>
        count({ employmentType: value }),
      ),
    ])
  const types = Object.fromEntries(
    employmentTypeOptions.map(({ value }, index) => [value, typeTotals[index]]),
  ) as Record<EmploymentType, number>
  return { total, active, onLeave, inactive, archived, types }
}

function ShareCell({
  value,
  total,
  label,
}: {
  value: number
  total: number
  label: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <span className="flex items-center gap-3">
      <InlineBar
        value={value}
        max={total}
        label={`${label}: ${pct}%`}
        className="min-w-12 flex-1"
      />
      <span className="w-8 text-right text-[#8a94a6] tabular-nums">{pct}%</span>
    </span>
  )
}

export function EmployeeOverviewPage() {
  const overview = useAsyncResource(loadOverview, [], {
    fallbackError: "Couldn't load employee figures.",
  })
  const data = overview.data
  const departmentList = useDepartments()
  // One reveal for the whole page: every section keeps its skeleton until
  // both the counts and the department list have arrived (or failed).
  const loading =
    (!data && !overview.error) ||
    (departmentList.loading && !departmentList.data)
  const departments = [...departmentList.departments].sort(
    (a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name),
  )
  const placed = departments.reduce((sum, d) => sum + d.memberCount, 0)
  const total = data?.total ?? 0

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Employee overview"
    >
      <PageHeader
        title="Employee Overview"
        description="Headcount, availability, and where employees are placed."
        actions={
          <PageHeaderLink href="/employees">Manage employees</PageHeaderLink>
        }
      />
      {overview.error && !data && (
        <Alert className="mt-[18px]">
          {overview.error}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold underline"
            onClick={overview.retry}
          >
            Try again
          </button>
        </Alert>
      )}
      <FiguresRow
        label="Employee figures"
        loading={loading}
        items={[
          {
            label: "Employees",
            value: String(total),
            note: data?.archived ? `${data.archived} archived` : undefined,
          },
          { label: "Active", value: String(data?.active ?? 0) },
          { label: "On leave", value: String(data?.onLeave ?? 0) },
          {
            label: "Inactive",
            value: String(data?.inactive ?? 0),
            tone: (data?.inactive ?? 0) > 0 ? "danger" : undefined,
          },
        ]}
      />

      <Section title="Availability" className="mt-7">
        {loading ? (
          <Skeleton className="h-2 w-full rounded-full" />
        ) : (
          <CompositionBar
            label="Employee availability"
            segments={[
              {
                id: "active",
                label: "Active",
                value: data?.active ?? 0,
                color: "#29906b",
              },
              {
                id: "leave",
                label: "On leave",
                value: data?.onLeave ?? 0,
                color: "#d69a24",
              },
              {
                id: "inactive",
                label: "Inactive",
                value: data?.inactive ?? 0,
                color: "#c94a6a",
              },
            ]}
          />
        )}
      </Section>

      <div className="mt-9 grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section title="Employment type">
          {loading ? (
            <RowsSkeleton />
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={headCellClass}>Type</th>
                  <th className={cn(headCellClass, "text-right")}>Count</th>
                  <th className={cn(headCellClass, "w-[45%] pl-5")}>Share</th>
                </tr>
              </thead>
              <tbody>
                {employmentTypeOptions.map(({ value, label }) => (
                  <tr key={value}>
                    <td className={cn(cellClass, "font-medium text-[#182235]")}>
                      {label}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "text-right text-[#182235] tabular-nums",
                      )}
                    >
                      {data?.types[value] ?? 0}
                    </td>
                    <td className={cn(cellClass, "pl-5")}>
                      <ShareCell
                        value={data?.types[value] ?? 0}
                        total={total}
                        label={label}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="By department" aside={`${placed} placed`}>
          {loading ? (
            <RowsSkeleton rows={5} />
          ) : departments.length ? (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={headCellClass}>Department</th>
                  <th className={cn(headCellClass, "text-right")}>Employees</th>
                  <th
                    className={cn(
                      headCellClass,
                      "w-[45%] pl-5 max-[480px]:hidden",
                    )}
                  >
                    Share
                  </th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id}>
                    <td className={cn(cellClass, "pr-3")}>
                      <span
                        className={
                          department.memberCount
                            ? "font-medium text-[#182235]"
                            : "text-[#8a94a6]"
                        }
                      >
                        {department.name}
                      </span>
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "text-right tabular-nums",
                        department.memberCount
                          ? "text-[#182235]"
                          : "text-[#a45b12]",
                      )}
                    >
                      {department.memberCount || "None"}
                    </td>
                    <td className={cn(cellClass, "pl-5 max-[480px]:hidden")}>
                      {department.memberCount > 0 && (
                        <ShareCell
                          value={department.memberCount}
                          total={placed}
                          label={department.name}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 py-6 text-xs text-[#8a94a6]">
              {departmentList.error || "No departments yet."}
            </p>
          )}
        </Section>
      </div>
    </main>
  )
}
