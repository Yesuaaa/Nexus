"use client"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"

export type AttendanceTab =
  | "dashboard"
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
  | "policies-overview"
  | "assignments"
const headings: Record<AttendanceTab, { title: string; description: string }> =
  {
    dashboard: {
      title: "Attendance & Monitoring Dashboard",
      description:
        "Review attendance, records, audit activity, approvals, and policy summaries within your permitted scope.",
    },
    "logs-overview": {
      title: "Time Logs Overview",
      description:
        "Review check-in and check-out statistics, session statuses, and recent record changes.",
    },
    audit: {
      title: "Attendance Audit Trail",
      description:
        "Inspect recorded changes, corrections, and approval decisions within your permitted scope.",
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
    "policies-overview": {
      title: "Policies Overview",
      description:
        "Review your attendance policy inventory and assignment history.",
    },
    assignments: {
      title: "Policy Assignments",
      description:
        "Inspect current, scheduled, and previous assignments and assign policies to employees.",
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
      <div
        className={
          tab === "dashboard" || tab === "overview" || tab.endsWith("-overview")
            ? "mt-[18px] min-w-0 max-[560px]:mt-[14px]"
            : "mt-4 min-w-0"
        }
      >
        {children}
      </div>
    </main>
  )
}
