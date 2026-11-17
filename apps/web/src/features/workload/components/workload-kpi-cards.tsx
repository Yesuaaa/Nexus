import {
  ChartNoAxesColumn,
  TriangleAlert,
  UserCheck,
  Users,
} from "lucide-react"
import {
  ProgressMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import { getWorkloadMetrics, type WorkloadStaff } from "../model/workload"

function hours(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function share(value: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((value / total) * 100)}%`
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
  const overloaded = recorded.filter(
    (person) => person.metrics.availability === "Overloaded",
  ).length
  const utilization = capacity ? Math.round((assigned / capacity) * 100) : null
  const utilizationTone =
    utilization !== null && utilization > 100
      ? "bg-[#fbe9ee] text-[#b4234d]"
      : "bg-[#e8eef8] text-[#284f9e]"
  const utilizationCaptionTone =
    utilization !== null && utilization > 100 ? "text-[#b4234d]" : undefined

  const items: StatStripItem[] = [
    {
      label: "Total Staff",
      value: staff.length.toLocaleString("en-US"),
      caption: staff.length ? "Staff in your department" : "No staff yet",
      icon: Users,
      tone: "bg-[#e8eef8] text-[#284f9e]",
    },
    {
      label: "Available",
      value: available.toLocaleString("en-US"),
      caption:
        active.length === 0
          ? "No active staff"
          : `${share(available, active.length)} of active staff`,
      captionTone: available > 0 ? "text-[#25745b]" : undefined,
      icon: UserCheck,
      tone: "bg-[#e6f4ee] text-[#25745b]",
    },
    {
      label: "Avg. Utilization",
      value: utilization === null ? "—" : `${utilization}%`,
      caption:
        recorded.length === 0
          ? "Record capacity to calculate"
          : `${hours(assigned)}h assigned / ${hours(capacity)}h capacity`,
      captionTone: utilizationCaptionTone,
      icon: ChartNoAxesColumn,
      tone: utilizationTone,
      meter: (
        <ProgressMeter
          value={Math.min(assigned, capacity)}
          max={capacity}
          label="Assigned hours against capacity"
          colorClass={
            utilization !== null && utilization > 100
              ? "bg-[#c94a6a]"
              : "bg-[#4169bd]"
          }
        />
      ),
    },
    {
      label: "Overloaded",
      value: overloaded.toLocaleString("en-US"),
      caption:
        overloaded === 0
          ? "Within recorded capacity"
          : `${share(overloaded, active.length)} of active staff`,
      captionTone: overloaded > 0 ? "text-[#b4234d]" : "text-[#25745b]",
      icon: TriangleAlert,
      tone:
        overloaded > 0
          ? "bg-[#fbe9ee] text-[#b4234d]"
          : "bg-[#e6f4ee] text-[#25745b]",
    },
  ]

  return (
    <StatStrip
      items={items}
      label="Staff workload overview"
      pending={pending}
      unavailable={unavailable}
    />
  )
}
