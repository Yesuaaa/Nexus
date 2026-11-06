import type { ReactNode } from "react"
import {
  ChartNoAxesColumn,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react"
import { KpiCards, type KpiMetric } from "@/components/ui/kpi-cards"
import { HoverTooltip } from "@/components/ui/hover-tooltip"
import { getWorkloadMetrics, type WorkloadStaff } from "../model/workload"

type Segment = { label: string; value: number; color: string }

function hours(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function CompactChart({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={0}
      className="h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203f8c]"
    >
      {children}
      <HoverTooltip
        align="end"
        className="max-w-64 text-left leading-relaxed whitespace-normal"
      >
        {label}
      </HoverTooltip>
    </div>
  )
}

function StaffComposition({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <CompactChart
      label={`Staff by status: ${segments.map((s) => `${s.label}: ${s.value}`).join("; ")}`}
    >
      <svg viewBox="0 0 72 32" className="h-full w-full" aria-hidden="true">
        <circle
          cx="51"
          cy="16"
          r="12"
          fill="none"
          stroke="#e3e9ef"
          strokeWidth="4"
        />
        {segments.map((segment, index) => {
          const proportion = total ? (segment.value / total) * 100 : 0
          const start = total
            ? (segments
                .slice(0, index)
                .reduce((sum, previous) => sum + previous.value, 0) /
                total) *
              100
            : 0
          return proportion > 0 ? (
            <circle
              key={segment.label}
              cx="51"
              cy="16"
              r="12"
              pathLength="100"
              fill="none"
              stroke={segment.color}
              strokeWidth="4"
              strokeDasharray={`${proportion} ${100 - proportion}`}
              strokeDashoffset={-start}
              transform="rotate(-90 51 16)"
            />
          ) : null
        })}
      </svg>
    </CompactChart>
  )
}

function AvailabilityBreakdown({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <CompactChart
      label={`Active staff availability: ${segments.map((s) => `${s.label}: ${s.value}`).join("; ")}`}
    >
      <div className="pt-1.5">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-[#e3e9ef]">
          {segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.label}
                className="h-full"
                style={{
                  width: `${(segment.value / total) * 100}%`,
                  backgroundColor: segment.color,
                }}
              />
            ))}
        </div>
        <p className="mt-1 mb-0 text-right text-[8px] leading-3 text-[#738096]">
          {total
            ? `${segments[0].value}/${total} available`
            : "No active staff"}
        </p>
      </div>
    </CompactChart>
  )
}

function UtilizationBar({
  assigned,
  capacity,
  recorded,
  active,
}: {
  assigned: number
  capacity: number
  recorded: number
  active: number
}) {
  const scale = Math.max(assigned, capacity, 1) * 1.15
  const label = recorded
    ? `Weekly utilization: ${hours(assigned)} hours assigned against ${hours(capacity)} hours capacity; ${recorded} of ${active} active staff have complete hours`
    : "Record capacity and assignment hours to view utilization."
  return (
    <CompactChart label={label}>
      <svg viewBox="0 0 72 32" className="h-full w-full" aria-hidden="true">
        <rect x="0" y="7" width="72" height="6" rx="3" fill="#e3e9ef" />
        {recorded ? (
          <>
            <rect
              x="0"
              y="7"
              width={(assigned / scale) * 72}
              height="6"
              rx="3"
              fill={assigned > capacity ? "#d81758" : "#4169bd"}
            />
            {capacity > 0 && (
              <>
                <path
                  d={`M ${(capacity / scale) * 72} 4 V 16`}
                  stroke="#65718a"
                />
                <text
                  x={(capacity / scale) * 72}
                  y="27"
                  textAnchor="middle"
                  fontSize="7"
                  fill="#738096"
                >
                  100%
                </text>
              </>
            )}
          </>
        ) : (
          <text x="72" y="27" textAnchor="end" fontSize="8" fill="#738096">
            No data
          </text>
        )}
      </svg>
    </CompactChart>
  )
}

function OverloadBars({
  people,
  recorded,
}: {
  people: { id: string; name: string; excess: number }[]
  recorded: number
}) {
  const max = Math.max(...people.map((person) => person.excess), 1)
  const total = people.reduce((sum, person) => sum + person.excess, 0)
  const label = people.length
    ? `Hours over capacity: ${people.map((p) => `${p.name}: ${hours(p.excess)} hours`).join("; ")}; ${hours(total)} total excess hours`
    : recorded
      ? "No staff exceed recorded capacity: 0 excess hours"
      : "Overload data unavailable: no complete hours recorded"
  return (
    <CompactChart label={label}>
      <svg viewBox="0 0 72 32" className="h-full w-full" aria-hidden="true">
        {(people.length
          ? people.slice(0, 3)
          : [{ id: "empty", excess: 0 }]
        ).map((person, index) => (
          <g key={person.id}>
            <rect
              x="0"
              y={3 + index * 6}
              width="72"
              height="3"
              rx="1.5"
              fill="#e3e9ef"
            />
            <rect
              x="0"
              y={3 + index * 6}
              width={(person.excess / max) * 72}
              height="3"
              rx="1.5"
              fill="#d81758"
            />
          </g>
        ))}
        <text x="72" y="30" textAnchor="end" fontSize="8" fill="#738096">
          {recorded ? `${hours(total)}h excess` : "No data"}
        </text>
      </svg>
    </CompactChart>
  )
}

export function WorkloadKpiCards({
  staff,
  pending,
  unavailable,
}: {
  staff: WorkloadStaff[]
  pending: boolean
  unavailable: boolean
}) {
  const rows = staff.map((person) => ({
    ...person,
    metrics: getWorkloadMetrics(person),
  }))
  const active = rows.filter((person) => person.status === "ACTIVE")
  const recorded = active.filter(
    (person) => person.metrics.capacity !== null && !person.metrics.unknown,
  )
  const capacity = recorded.reduce(
    (sum, person) => sum + (person.metrics.capacity ?? 0),
    0,
  )
  const assigned = recorded.reduce(
    (sum, person) => sum + person.metrics.assigned,
    0,
  )
  const available = active.filter(
    (person) => person.metrics.availability === "Available",
  ).length
  const needsSetup = active.filter(
    (person) => person.metrics.availability === "Needs setup",
  ).length
  const overloaded = recorded
    .filter((person) => person.metrics.availability === "Overloaded")
    .map((person) => ({
      id: person.id,
      name: person.fullName,
      excess: person.metrics.assigned - (person.metrics.capacity ?? 0),
    }))
    .sort((a, b) => b.excess - a.excess || a.name.localeCompare(b.name))
  const summary: KpiMetric[] = [
    {
      label: "Total Staff",
      value: staff.length,
      description: "Staff in your department",
      icon: Users,
      iconClassName: "text-[#2058d4]",
      chart: (
        <StaffComposition
          segments={[
            { label: "Active", value: active.length, color: "#4169bd" },
            {
              label: "On leave",
              value: rows.filter((person) => person.status === "ON_LEAVE")
                .length,
              color: "#d69a24",
            },
            {
              label: "Inactive",
              value: rows.filter(
                (person) =>
                  person.status !== "ACTIVE" && person.status !== "ON_LEAVE",
              ).length,
              color: "#94a3b8",
            },
          ]}
        />
      ),
    },
    {
      label: "Available Staff",
      value: available,
      description: "Available for additional work",
      icon: UserCheck,
      iconClassName: "text-[#159447]",
      chart: (
        <AvailabilityBreakdown
          segments={[
            { label: "Available", value: available, color: "#29906b" },
            {
              label: "Limited capacity",
              value: active.length - available - needsSetup,
              color: "#d69a24",
            },
            { label: "Needs setup", value: needsSetup, color: "#94a3b8" },
          ]}
        />
      ),
    },
    {
      label: "Avg. Utilization",
      value: capacity ? Math.round((assigned / capacity) * 100) : 0,
      formattedValue: capacity
        ? `${Math.round((assigned / capacity) * 100)}%`
        : "—",
      description: "Assigned hours against capacity",
      icon: ChartNoAxesColumn,
      iconClassName: "text-[#2058d4]",
      chart: (
        <UtilizationBar
          assigned={assigned}
          capacity={capacity}
          recorded={recorded.length}
          active={active.length}
        />
      ),
    },
    {
      label: "Overloaded",
      value: overloaded.length,
      description: "Staff exceeding weekly capacity",
      icon: TriangleAlert,
      iconClassName: "text-[#d81758]",
      chart: <OverloadBars people={overloaded} recorded={recorded.length} />,
    },
  ]
  return (
    <KpiCards
      metrics={summary}
      label="Staff workload overview"
      pending={pending}
      unavailable={unavailable}
      className="grid-cols-4 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1"
    />
  )
}
