"use client"

import { PageHeader } from "@/components/layout/page-header"
import { PageHeaderLink } from "@/components/layout/page-header-link"
import { contentClass } from "@/components/layout/styles"
import { Alert } from "@/components/ui/alert"
import {
  cellClass,
  FiguresRow,
  headCellClass,
  InlineBar,
  RowsSkeleton,
  Section,
  tableClass,
} from "@/components/ui/overview-panel"
import { useDatePreferences } from "@/features/settings/providers/preferences-provider"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"
import { useDepartments } from "../hooks/use-departments"

function names(departments: Department[]) {
  return departments.map((department) => department.name).join(", ")
}

export function DepartmentOverviewPage() {
  const { formatDate } = useDatePreferences()
  const list = useDepartments()
  const { departments, error, retry } = list
  const loading = list.loading && !list.data
  const count = departments.length
  const employees = departments.reduce((sum, d) => sum + d.memberCount, 0)
  const teams = departments.reduce((sum, d) => sum + (d.teamCount ?? 0), 0)
  const byName = [...departments].sort((a, b) => a.name.localeCompare(b.name))
  const withoutHead = byName.filter((d) => !d.head)
  const withoutEmployees = byName.filter((d) => d.memberCount === 0)
  const withoutServices = byName.filter((d) => (d.serviceCount ?? 0) === 0)
  const bySize = [...departments].sort(
    (a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name),
  )
  const gaps = [
    ["Without a head", withoutHead],
    ["No employees", withoutEmployees],
    ["No services", withoutServices],
  ] as const

  return (
    <main
      className={cn(contentClass, "p-[clamp(16px,2.1vw,32px)]")}
      aria-label="Department overview"
    >
      <PageHeader
        title="Department Overview"
        description="Staffing, leadership, and coverage for every department."
        actions={
          <PageHeaderLink href="/departments">
            Manage departments
          </PageHeaderLink>
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
      <FiguresRow
        label="Department figures"
        loading={loading}
        items={[
          { label: "Departments", value: String(count) },
          { label: "Employees", value: String(employees) },
          { label: "Teams", value: String(teams) },
          {
            label: "With a head",
            value: `${count - withoutHead.length}/${count}`,
            note: withoutHead.length
              ? `${withoutHead.length} without a head`
              : undefined,
            tone: withoutHead.length ? "warning" : undefined,
          },
        ]}
      />

      <Section title="Departments" aside="By headcount" className="mt-7">
        {loading ? (
          <RowsSkeleton rows={5} />
        ) : count ? (
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={headCellClass}>Department</th>
                <th className={cn(headCellClass, "max-[640px]:hidden")}>
                  Head
                </th>
                <th className={cn(headCellClass, "w-[28%] pl-4")}>Employees</th>
                <th
                  className={cn(headCellClass, "text-right max-[640px]:hidden")}
                >
                  Teams
                </th>
                <th
                  className={cn(headCellClass, "text-right max-[640px]:hidden")}
                >
                  Services
                </th>
                <th
                  className={cn(
                    headCellClass,
                    "pl-6 text-right max-[1024px]:hidden",
                  )}
                >
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {bySize.map((department) => {
                const pct =
                  employees > 0
                    ? Math.round((department.memberCount / employees) * 100)
                    : 0
                return (
                  <tr key={department.id}>
                    <td className={cn(cellClass, "pr-3")}>
                      <span className="font-medium text-[#182235]">
                        {department.name}
                      </span>
                      {department.code && (
                        <span className="ml-2 text-[11px] text-[#8a94a6]">
                          {department.code}
                        </span>
                      )}
                    </td>
                    <td className={cn(cellClass, "pr-3 max-[640px]:hidden")}>
                      {department.head ? (
                        <span className="text-[#3b4658]">
                          {department.head.fullName || department.head.email}
                        </span>
                      ) : (
                        <span className="text-[#a45b12]">No head</span>
                      )}
                    </td>
                    <td className={cn(cellClass, "pl-4")}>
                      <span className="flex items-center gap-3">
                        <span className="w-6 text-right font-medium text-[#182235] tabular-nums">
                          {department.memberCount}
                        </span>
                        <InlineBar
                          value={department.memberCount}
                          max={employees}
                          label={`${department.name}: ${pct}% of employees`}
                          className="min-w-12 flex-1"
                        />
                        <span className="w-8 text-right text-[#8a94a6] tabular-nums">
                          {pct}%
                        </span>
                      </span>
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "text-right text-[#3b4658] tabular-nums max-[640px]:hidden",
                      )}
                    >
                      {department.teamCount ?? 0}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "text-right tabular-nums max-[640px]:hidden",
                        (department.serviceCount ?? 0) === 0
                          ? "text-[#a45b12]"
                          : "text-[#3b4658]",
                      )}
                    >
                      {department.serviceCount ?? 0}
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "pl-6 text-right whitespace-nowrap text-[#8a94a6] max-[1024px]:hidden",
                      )}
                    >
                      {formatDate(department.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="m-0 py-6 text-xs text-[#8a94a6]">No departments yet.</p>
        )}
      </Section>

      {!loading && count > 0 && (
        <Section title="Gaps" className="mt-8">
          {gaps.some(([, items]) => items.length) ? (
            <dl className="m-0 grid gap-2 text-xs">
              {gaps
                .filter(([, items]) => items.length)
                .map(([label, items]) => (
                  <div
                    key={label}
                    className="flex gap-4 max-[560px]:flex-col max-[560px]:gap-0.5"
                  >
                    <dt className="w-32 shrink-0 text-[#738096]">{label}</dt>
                    <dd className="m-0 text-[#182235]">{names([...items])}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="m-0 text-xs text-[#3b4658]">
              None. Every department has a head, employees, and services.
            </p>
          )}
        </Section>
      )}
    </main>
  )
}
