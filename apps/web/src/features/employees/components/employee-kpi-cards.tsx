import { CalendarClock, UserCheck, UserX, UsersRound } from "lucide-react"
import {
  ProgressMeter,
  SegmentMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"

export type EmployeeKpiSummary = {
  total: number
  active: number
  onLeave: number
  inactive: number
}

function share(value: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((value / total) * 100)}%`
}

export function EmployeeKpiCards({
  summary,
  pending,
  unavailable,
}: {
  summary: EmployeeKpiSummary
  pending: boolean
  unavailable: boolean
}) {
  const { total, active, onLeave, inactive } = summary
  const empty = total === 0

  const items: StatStripItem[] = [
    {
      label: "Employees",
      value: total.toLocaleString("en-US"),
      caption: empty ? "No employee records yet" : "Employee records",
      icon: UsersRound,
      tone: "bg-[#e8eef8] text-[#284f9e]",
      meter: (
        <SegmentMeter
          label="Employee status breakdown"
          segments={[
            { label: "Active", value: active, colorClass: "bg-[#29906b]" },
            { label: "On leave", value: onLeave, colorClass: "bg-[#d69a24]" },
            { label: "Inactive", value: inactive, colorClass: "bg-[#c94a6a]" },
          ]}
        />
      ),
    },
    {
      label: "Active",
      value: active.toLocaleString("en-US"),
      caption: empty ? "—" : `${share(active, total)} of employees`,
      captionTone: empty ? undefined : "text-[#25745b]",
      icon: UserCheck,
      tone: "bg-[#e6f4ee] text-[#25745b]",
      meter: (
        <ProgressMeter
          value={active}
          max={total}
          label="Active employees"
          colorClass="bg-[#29906b]"
        />
      ),
    },
    {
      label: "On leave",
      value: onLeave.toLocaleString("en-US"),
      caption: onLeave === 0 ? "Everyone is available" : "Temporarily away",
      captionTone: onLeave > 0 ? "text-[#9a5b00]" : undefined,
      icon: CalendarClock,
      tone: "bg-[#fbf0e2] text-[#a45b12]",
      meter: (
        <ProgressMeter
          value={onLeave}
          max={total}
          label="Employees on leave"
          colorClass="bg-[#d69a24]"
        />
      ),
    },
    {
      label: "Inactive",
      value: inactive.toLocaleString("en-US"),
      caption: inactive === 0 ? "None inactive" : "Not currently working",
      captionTone: inactive > 0 ? "text-[#b4234d]" : undefined,
      icon: UserX,
      tone: "bg-[#fbe9ee] text-[#b4234d]",
      meter: (
        <ProgressMeter
          value={inactive}
          max={total}
          label="Inactive employees"
          colorClass="bg-[#c94a6a]"
        />
      ),
    },
  ]

  return (
    <StatStrip
      items={items}
      label="Employee overview"
      pending={pending}
      unavailable={unavailable}
    />
  )
}
