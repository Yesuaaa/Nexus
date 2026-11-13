"use client"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"

export type AttendanceTab =
  "overview" | "my" | "records" | "adjustments" | "settings"
const headings: Record<AttendanceTab, { title: string; description: string }> =
  {
    overview: {
      title: "Attendance Overview",
      description:
        "Monitor recorded workdays, daily requirements, and attendance exceptions.",
    },
    my: {
      title: "Check-Ins",
      description:
        "Record your working time, manage unpaid breaks, and review your attendance history.",
    },
    records: {
      title: "Time Logs",
      description:
        "Review employee time logs, filter workdays, and monitor records within your permitted scope.",
    },
    adjustments: {
      title: "OT & Agreements",
      description:
        "Submit and review attendance corrections and overtime requests within your permitted scope.",
    },
    settings: {
      title: "Policies",
      description:
        "Manage attendance policies, daily work-hour requirements, and employee assignments.",
    },
  }
export function AttendanceShell({
  tab,
  children,
  actions,
}: {
  tab: AttendanceTab
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Attendance workspace"
    >
      <PageHeader {...headings[tab]} actions={actions} />
      <div className="mt-4 min-w-0">{children}</div>
    </main>
  )
}
