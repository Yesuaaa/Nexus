"use client"

import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  BreakdownList,
  ItemList,
  MiniStats,
  OverviewPanel,
} from "@/components/ui/overview-panel"
import { useDepartments } from "@/features/departments/hooks/use-departments"
import { useAsyncResource } from "@/lib/use-async-resource"
import { cn } from "@/lib/utils"
import {
  listEmployees,
  type EmploymentStatus,
  type EmploymentType,
} from "../api/employees-api"
import {
  EmployeeKpiCards,
  type EmployeeKpiSummary,
} from "../components/employee-kpi-cards"
import { employmentTypeOptions } from "../model/employment"

type EmployeeOverview = EmployeeKpiSummary & {
  types: Record<EmploymentType, number>
  archived: number
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

export function EmployeeOverviewPage() {
  const overview = useAsyncResource(loadOverview, [], {
    fallbackError: "Couldn't load employee figures.",
  })
  const data = overview.data
  const loading = !data && !overview.error
  const departmentList = useDepartments()
  const departmentsLoading = departmentList.loading && !departmentList.data
  const departments = departmentList.departments
  const staffed = departments
    .filter((department) => department.memberCount > 0)
    .sort((a, b) => b.memberCount - a.memberCount)
  const placed = staffed.reduce((sum, d) => sum + d.memberCount, 0)
  const unstaffed = departments
    .filter((department) => department.memberCount === 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  const total = data?.total ?? 0

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Employee overview"
    >
      <PageHeader
        title="Employee Overview"
        description="Headcount, availability, employment types, and where employees are placed."
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/employees">Manage employees</Link>
          </Button>
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
      <div className="mt-[18px] grid gap-4 max-[560px]:mt-[14px]">
        <EmployeeKpiCards
          summary={data ?? { total: 0, active: 0, onLeave: 0, inactive: 0 }}
          pending={loading}
          unavailable={Boolean(overview.error) && !data}
        />
        <MiniStats
          label="Employee figures"
          loading={loading || departmentsLoading}
          items={[
            {
              label: "Archived records",
              value: (data?.archived ?? 0).toLocaleString("en-US"),
              hint: "Kept for history",
            },
            {
              label: "Departments staffed",
              value: `${staffed.length}/${departments.length}`,
              hint: unstaffed.length
                ? `${unstaffed.length} without employees`
                : "Every department staffed",
            },
            {
              label: "Average per department",
              value: staffed.length
                ? (placed / staffed.length).toFixed(1)
                : "—",
              hint: "Across staffed departments",
            },
            {
              label: "Largest department",
              value: staffed[0]?.name ?? "—",
              hint: staffed[0]
                ? `${staffed[0].memberCount} employees`
                : undefined,
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Employment type"
            description="Share of all employee records"
          >
            <BreakdownList
              rows={employmentTypeOptions.map(({ value, label }) => ({
                id: value,
                label,
                value: data?.types[value] ?? 0,
              }))}
              total={total}
              loading={loading}
              unit="employees"
              empty="No employee records yet."
              colorClass="bg-[#284f9e]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Availability"
            description="Employment status as a share of headcount"
          >
            <BreakdownList
              rows={[
                { id: "active", label: "Active", value: data?.active ?? 0 },
                {
                  id: "leave",
                  label: "On leave",
                  value: data?.onLeave ?? 0,
                },
                {
                  id: "inactive",
                  label: "Inactive",
                  value: data?.inactive ?? 0,
                },
              ]}
              total={total}
              loading={loading}
              unit="employees"
              empty="No employee records yet."
              colorClass="bg-[#29906b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Employees by department"
            description="Assigned employees in each department"
          >
            <BreakdownList
              rows={staffed.slice(0, 8).map((department) => ({
                id: department.id,
                label: department.name,
                value: department.memberCount,
              }))}
              loading={departmentsLoading}
              unit="employees"
              empty={
                departmentList.error ||
                "No employees are assigned to a department yet."
              }
              colorClass="bg-[#29906b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Departments without employees"
            description="Departments to staff next"
          >
            <ItemList
              rows={unstaffed.map((department) => ({
                id: department.id,
                label: department.name,
                note: "No employees",
                tone: "warning",
              }))}
              loading={departmentsLoading}
              empty={
                departments.length
                  ? "Every department has employees."
                  : "No departments yet."
              }
              emptyTone={departments.length ? "success" : "muted"}
            />
          </OverviewPanel>
        </div>
      </div>
    </main>
  )
}
