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
  type BreakdownRow,
} from "@/components/ui/overview-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { DepartmentKpiCards } from "../components/department-kpi-cards"
import { useDepartments } from "../hooks/use-departments"

function ranked(
  departments: Department[],
  value: (department: Department) => number,
): BreakdownRow[] {
  return departments
    .filter((department) => value(department) > 0)
    .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name))
    .slice(0, 8)
    .map((department) => ({
      id: department.id,
      label: department.name,
      value: value(department),
    }))
}

function average(total: number, count: number) {
  if (count === 0) return "—"
  const value = total / count
  return value.toFixed(value < 10 ? 1 : 0)
}

export function DepartmentOverviewPage() {
  const { formatDate } = useDatePreferences()
  const list = useDepartments()
  const { departments, error, retry } = list
  const loading = list.loading && !list.data
  const count = departments.length
  const employees = departments.reduce((sum, d) => sum + d.memberCount, 0)
  const teams = departments.reduce((sum, d) => sum + (d.teamCount ?? 0), 0)
  const bySize = ranked(departments, (d) => d.memberCount)
  const newest = [...departments].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0]
  const byName = [...departments].sort((a, b) => a.name.localeCompare(b.name))
  const heads = [...byName]
    .sort((a, b) => Number(Boolean(a.head)) - Number(Boolean(b.head)))
    .map((department) => ({
      id: department.id,
      label: department.name,
      note: department.head
        ? department.head.fullName || department.head.email
        : "Needs a head",
      tone: department.head ? ("muted" as const) : ("warning" as const),
    }))
  const attention = byName.flatMap((department) => {
    const issues = [
      !department.head && "no head",
      department.memberCount === 0 && "no employees",
      (department.serviceCount ?? 0) === 0 && "no services",
    ].filter(Boolean)
    return issues.length
      ? [
          {
            id: department.id,
            label: department.name,
            note: `${issues.join(", ")}`.replace(/^./, (c) => c.toUpperCase()),
            tone: "warning" as const,
          },
        ]
      : []
  })

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Department overview"
    >
      <PageHeader
        title="Department Overview"
        description="Staffing, leadership, team structure, and service coverage across departments."
        actions={
          <Button asChild variant="brandOutline" size="header">
            <Link href="/departments">Manage departments</Link>
          </Button>
        }
      />
      {error && !count && (
        <Alert className="mt-[18px]">
          {error}{" "}
          <button
            type="button"
            className="cursor-pointer font-semibold underline"
            onClick={retry}
          >
            Try again
          </button>
        </Alert>
      )}
      <div className="mt-[18px] grid gap-4 max-[560px]:mt-[14px]">
        <DepartmentKpiCards
          departments={departments}
          loading={loading}
          unavailable={Boolean(error)}
        />
        <MiniStats
          label="Department figures"
          loading={loading}
          items={[
            {
              label: "Average department size",
              value: average(employees, count),
              hint: "Employees per department",
            },
            {
              label: "Teams per department",
              value: average(teams, count),
              hint: `${teams} teams in total`,
            },
            {
              label: "Largest department",
              value: bySize[0]?.label ?? "—",
              hint: bySize[0] ? `${bySize[0].value} employees` : undefined,
            },
            {
              label: "Newest department",
              value: newest?.name ?? "—",
              hint: newest
                ? `Created ${formatDate(newest.createdAt)}`
                : undefined,
            },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewPanel
            title="Largest departments"
            description="By number of employees"
          >
            <BreakdownList
              rows={bySize}
              loading={loading}
              unit="employees"
              empty="No department has employees yet."
              colorClass="bg-[#29906b]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Department heads"
            description="Who leads each department"
          >
            <ItemList
              rows={heads}
              loading={loading}
              empty="No departments yet."
            />
          </OverviewPanel>
          <OverviewPanel
            title="Teams per department"
            description="Sub-teams inside each department"
          >
            <BreakdownList
              rows={ranked(departments, (d) => d.teamCount ?? 0)}
              loading={loading}
              unit="teams"
              empty="No department has teams yet."
              colorClass="bg-[#6552a6]"
            />
          </OverviewPanel>
          <OverviewPanel
            title="Services per department"
            description="Catalog services each department delivers"
          >
            <BreakdownList
              rows={ranked(departments, (d) => d.serviceCount ?? 0)}
              loading={loading}
              unit="services"
              empty="No department delivers a service yet."
            />
          </OverviewPanel>
        </div>
        <OverviewPanel
          title="Needs attention"
          description="Departments missing a head, employees, or services"
        >
          <ItemList
            rows={attention}
            loading={loading}
            empty={
              count
                ? "Every department has a head, employees, and services."
                : "No departments yet."
            }
            emptyTone={count ? "success" : "muted"}
            limit={10}
          />
        </OverviewPanel>
      </div>
    </main>
  )
}
