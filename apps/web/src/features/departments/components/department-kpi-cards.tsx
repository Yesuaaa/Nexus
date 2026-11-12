import { Building2, Network, UserRoundCheck, UsersRound } from "lucide-react"
import {
  ProgressMeter,
  StatStrip,
  type StatStripItem,
} from "@/components/ui/stat-strip"
import type { Department } from "../api/departments-api"

export function DepartmentKpiCards({
  departments,
  loading,
  unavailable,
}: {
  departments: Department[]
  loading: boolean
  unavailable: boolean
}) {
  const total = departments.length
  const employeeCount = departments.reduce(
    (sum, department) => sum + department.memberCount,
    0,
  )
  const teamCount = departments.reduce(
    (sum, department) => sum + (department.teamCount ?? 0),
    0,
  )
  const departmentsWithTeams = departments.filter(
    (department) => (department.teamCount ?? 0) > 0,
  ).length
  const headed = departments.filter((department) => department.head).length
  const needHead = total - headed
  const average = total === 0 ? 0 : employeeCount / total
  const covered = needHead === 0

  const items: StatStripItem[] = [
    {
      label: "Departments",
      value: total.toLocaleString("en-US"),
      caption: "Organizational units",
      icon: Building2,
      tone: "bg-[#e8eef8] text-[#284f9e]",
    },
    {
      label: "Employees",
      value: employeeCount.toLocaleString("en-US"),
      caption:
        total === 0
          ? "No departments yet"
          : `≈ ${average.toFixed(average < 10 ? 1 : 0)} per department`,
      icon: UsersRound,
      tone: "bg-[#e6f4ee] text-[#25745b]",
    },
    {
      label: "Teams",
      value: teamCount.toLocaleString("en-US"),
      caption:
        total === 0
          ? "No departments yet"
          : `In ${departmentsWithTeams} of ${total} departments`,
      icon: Network,
      tone: "bg-[#efebf8] text-[#6552a6]",
    },
    {
      label: "Head coverage",
      value: `${headed}/${total}`,
      caption:
        total === 0
          ? "No departments yet"
          : covered
            ? "Every department has a head"
            : `${needHead} ${needHead === 1 ? "needs" : "need"} a head`,
      captionTone:
        total === 0 ? undefined : covered ? "text-[#25745b]" : "text-[#a45b12]",
      icon: UserRoundCheck,
      tone: covered
        ? "bg-[#e6f4ee] text-[#25745b]"
        : "bg-[#fbf0e2] text-[#a45b12]",
      meter: (
        <ProgressMeter
          value={headed}
          max={total}
          label="Departments with a head"
          colorClass={covered ? "bg-[#29906b]" : "bg-[#d08a33]"}
        />
      ),
    },
  ]

  return (
    <StatStrip
      items={items}
      label="Department overview"
      pending={loading && departments.length === 0}
      unavailable={unavailable && departments.length === 0}
    />
  )
}
