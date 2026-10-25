import {
  Building2,
  Network,
  UserRoundX,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import type { Department } from "../api/departments-api"

type DepartmentMetric = {
  label: string
  value: number
  description: string
  icon: LucideIcon
  iconClassName: string
  chartValues: number[]
  chartLabel: string
  chartColor: string
}

function MiniGraph({
  values,
  label,
  color,
}: {
  values: number[]
  label: string
  color: string
}) {
  const series = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0]
  const width = 240
  const top = 4
  const bottom = 38
  const maxValue = Math.max(...series, 1)
  const points = series.map((value, index) => ({
    x: (index / (series.length - 1)) * width,
    y: bottom - (value / maxValue) * (bottom - top),
  }))
  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")
  const lastPoint = points[points.length - 1]
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${bottom} L 0 ${bottom} Z`

  return (
    <svg
      className="mt-3 h-10 w-full overflow-visible"
      viewBox={`0 0 ${width} 42`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path d={`M 0 ${bottom} H ${width}`} stroke="#dfe6eb" />
      <path d={areaPath} fill={color} fillOpacity="0.1" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2.5"
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function DepartmentKpiCards({
  departments,
  loading,
  unavailable,
}: {
  departments: Department[]
  loading: boolean
  unavailable: boolean
}) {
  const employeeCount = departments.reduce(
    (total, department) => total + department.memberCount,
    0,
  )
  const teamCount = departments.reduce(
    (total, department) => total + (department.teamCount ?? 0),
    0,
  )
  const assignedHeadCount = departments.filter(
    (department) => department.head,
  ).length
  const unassignedHeadCount = departments.length - assignedHeadCount
  const departmentsByName = [...departments].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const departmentsByCreation = [...departments].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
  const metrics: DepartmentMetric[] = [
    {
      label: "Departments",
      value: departments.length,
      description: "Organizational units",
      icon: Building2,
      iconClassName: "text-[#284f9e]",
      chartValues: departmentsByCreation.map((_, index) => index + 1),
      chartLabel: "Cumulative departments by creation date",
      chartColor: "#4169bd",
    },
    {
      label: "Assigned employees",
      value: employeeCount,
      description: "Across all departments",
      icon: UsersRound,
      iconClassName: "text-[#25745b]",
      chartValues: departmentsByName.map(
        (department) => department.memberCount,
      ),
      chartLabel: "Employee distribution across departments",
      chartColor: "#29906b",
    },
    {
      label: "Teams",
      value: teamCount,
      description: "Created within departments",
      icon: Network,
      iconClassName: "text-[#6552a6]",
      chartValues: departmentsByName.map(
        (department) => department.teamCount ?? 0,
      ),
      chartLabel: "Team distribution across departments",
      chartColor: "#7159bd",
    },
    {
      label: "Heads unassigned",
      value: unassignedHeadCount,
      description:
        departments.length === 0
          ? "No departments created"
          : `${assignedHeadCount} of ${departments.length} departments covered`,
      icon: UserRoundX,
      iconClassName:
        unassignedHeadCount > 0 ? "text-[#a45b12]" : "text-[#25745b]",
      chartValues: departmentsByName.map((department) =>
        department.head ? 0 : 1,
      ),
      chartLabel: "Unassigned head status across departments",
      chartColor: unassignedHeadCount > 0 ? "#c27625" : "#29906b",
    },
  ]
  const pending = loading && departments.length === 0
  const showUnavailable = unavailable && departments.length === 0

  return (
    <section
      className="grid min-w-0 grid-cols-4 gap-3.5 @container max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
      aria-label="Department overview"
      aria-busy={pending}
    >
      {metrics.map((metric) => {
        const Icon = metric.icon

        return (
          <article
            key={metric.label}
            className="min-w-0 rounded-xl border border-[#dfe6eb] bg-[#f8fafb] p-4 shadow-[0_2px_8px_rgb(30_55_80_/_5%)]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon
                className={metric.iconClassName}
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <h2 className="m-0 truncate text-xs font-medium text-[#65718a]">
                {metric.label}
              </h2>
            </div>
            {pending ? (
              <>
                <div className="mt-3 h-7 w-16 animate-pulse rounded-md bg-[#dfe6eb] motion-reduce:animate-none">
                  <span className="sr-only">Loading {metric.label}</span>
                </div>
                <div className="mt-3 h-10 animate-pulse rounded-md bg-[#edf1f4] motion-reduce:animate-none" />
              </>
            ) : (
              <>
                <p className="mt-3 mb-0 text-2xl leading-none font-semibold tracking-[-0.025em] text-foreground tabular-nums">
                  {showUnavailable ? "—" : metric.value.toLocaleString("en-US")}
                </p>
                <p className="mt-1.5 mb-0 truncate text-[11px] text-[#738096]">
                  {showUnavailable ? "Data unavailable" : metric.description}
                </p>
                <MiniGraph
                  values={showUnavailable ? [] : metric.chartValues}
                  label={
                    showUnavailable
                      ? "Chart data unavailable"
                      : metric.chartLabel
                  }
                  color={metric.chartColor}
                />
              </>
            )}
          </article>
        )
      })}
    </section>
  )
}
