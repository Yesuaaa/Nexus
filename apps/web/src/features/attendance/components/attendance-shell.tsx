"use client"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"

export type AttendanceTab =
  | "overview"
  | "my"
  | "records"
  | "adjustments"
  | "settings"
  | "logs-overview"
  | "audit"
  | "requests-overview"
  | "overtime"
  | "corrections"
  | "leave"
  | "policies-overview"
const headings: Record<AttendanceTab, { title: string; description: string }> =
  {
    "logs-overview": {
      title: "Time Logs Overview",
      description:
        "Review check-in and check-out statistics, session statuses, and employee coverage.",
    },
    audit: {
      title: "Attendance Audit Trail",
      description:
        "Inspect attendance changes, overtime requests, corrections, approval decisions, and policy changes within your permitted scope.",
    },
    "requests-overview": {
      title: "Requests & Approvals Overview",
      description:
        "Monitor overtime verification and attendance correction decisions within your permitted scope.",
    },
    overtime: {
      title: "Overtime",
      description:
        "Review automatically submitted excess hours, department verification, and HR decisions.",
    },
    corrections: {
      title: "Attendance Corrections",
      description:
        "Request and review missing or incorrect attendance records.",
    },
    leave: {
      title: "Leave Requests",
      description:
        "Request dated leave and review department or organization approvals within your permitted scope.",
    },
    "policies-overview": {
      title: "Policies Overview",
      description:
        "Review your attendance policy inventory and assignment history.",
    },
    overview: {
      title: "Attendance Overview",
      description:
        "Monitor check-ins, check-outs, breaks, and recent attendance activity.",
    },
    my: {
      title: "Check-Ins",
      description:
        "Record your working time, manage unpaid breaks, and review your attendance history.",
    },
    records: {
      title: "Time Log Records",
      description:
        "Review employee time logs, filter workdays, and monitor records within your permitted scope.",
    },
    adjustments: {
      title: "Requests & Approvals",
      description:
        "Submit and review attendance corrections and overtime requests within your permitted scope.",
    },
    settings: {
      title: "Policy Management",
      description:
        "Manage attendance policies, daily work-hour requirements, and employee assignments.",
    },
  }
export function AttendanceShell({
  tab,
  title,
  children,
  actions,
}: {
  tab: AttendanceTab
  title?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <main
      className={`${contentClass} p-[clamp(16px,2.1vw,32px)]`}
      aria-label="Attendance workspace"
    >
      <PageHeader
        {...headings[tab]}
        title={title ?? headings[tab].title}
        actions={actions}
      />
      <div
        className={
          tab === "overview" || tab.endsWith("-overview")
            ? "mt-[18px] min-w-0 max-[560px]:mt-[14px]"
            : "mt-4 min-w-0"
        }
      >
        {children}
      </div>
    </main>
  )
}
