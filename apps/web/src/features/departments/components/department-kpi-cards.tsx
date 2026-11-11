import type { LucideIcon } from "lucide-react"
import { Building2, Network, UserRoundCheck, UsersRound } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { Department } from "../api/departments-api"

type Stat = {
  label: string
  value: string
  caption: string
  icon: LucideIcon
  tone: string
  captionTone?: string
  progress?: number
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
  const pending = loading && departments.length === 0
  const missing = unavailable && departments.length === 0
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

  const stats: Stat[] = [
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
          : needHead === 0
            ? "Every department has a head"
            : `${needHead} ${needHead === 1 ? "needs" : "need"} a head`,
      captionTone:
        total > 0
          ? needHead === 0
            ? "text-[#25745b]"
            : "text-[#a45b12]"
          : undefined,
      icon: UserRoundCheck,
      tone:
        needHead === 0
          ? "bg-[#e6f4ee] text-[#25745b]"
          : "bg-[#fbf0e2] text-[#a45b12]",
      progress: total === 0 ? 0 : headed / total,
    },
  ]

  return (
    <section
      aria-label="Department overview"
      aria-busy={pending}
      className="grid min-w-0 grid-cols-4 overflow-hidden rounded-xl border border-[#dfe6eb] bg-background shadow-[0_1px_2px_rgb(30_55_80_/_4%)] max-[1050px]:grid-cols-2 max-[560px]:grid-cols-1"
    >
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <article
            key={stat.label}
            className={cn(
              "flex min-w-0 flex-col gap-3 px-5 py-4",
              // Dividers between cells for each grid layout.
              index > 0 &&
                "min-[1051px]:border-l min-[1051px]:border-[#eceef1]",
              index % 2 === 1 &&
                "max-[1050px]:border-l max-[1050px]:border-[#eceef1] max-[560px]:border-l-0",
              index > 1 &&
                "max-[1050px]:border-t max-[1050px]:border-[#eceef1]",
              index > 0 && "max-[560px]:border-t max-[560px]:border-[#eceef1]",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "grid size-7 flex-none place-items-center rounded-lg",
                  stat.tone,
                )}
                aria-hidden="true"
              >
                <Icon size={15} strokeWidth={1.9} />
              </span>
              <h2 className="m-0 truncate text-xs font-medium text-[#65718a]">
                {stat.label}
              </h2>
            </div>
            {pending ? (
              <div className="grid gap-2">
                <Skeleton className="h-7 w-14 rounded-md" />
                <Skeleton className="h-2.5 w-28" />
                <span className="sr-only">Loading {stat.label}</span>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <p className="m-0 text-[26px] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                  {missing ? "—" : stat.value}
                </p>
                {stat.progress !== undefined && !missing && (
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef1f4]"
                    role="progressbar"
                    aria-label="Departments with a head"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={headed}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                        needHead === 0 ? "bg-[#29906b]" : "bg-[#d08a33]",
                      )}
                      style={{ width: `${Math.round(stat.progress * 100)}%` }}
                    />
                  </div>
                )}
                <p
                  className={cn(
                    "m-0 truncate text-[11px]",
                    missing
                      ? "text-[#738096]"
                      : (stat.captionTone ?? "text-[#738096]"),
                  )}
                >
                  {missing ? "Data unavailable" : stat.caption}
                </p>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
