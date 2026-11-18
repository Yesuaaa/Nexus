"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useSearchParams } from "next/navigation"
import {
  parseWorkspaceDirectoryState,
  serializeWorkspaceDirectoryState,
} from "@/features/project-workspace/model/workspace-directory-state"
import {
  getModuleLogsLabel,
  moduleRegistry,
} from "@/features/workspaces/model/module-registry"
import { ChevronRightIcon, HomeIcon } from "./icons"
import { focusRing } from "./styles"

type BreadcrumbLabels = Record<string, string>
type BreadcrumbLabelContextValue = {
  labels: BreadcrumbLabels
  setLabel: (key: string, label: string | null) => void
}

const BreadcrumbLabelContext = createContext<BreadcrumbLabelContextValue>({
  labels: {},
  setLabel: () => undefined,
})

export function BreadcrumbLabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<BreadcrumbLabels>({})
  const setLabel = useCallback((key: string, label: string | null) => {
    setLabels((current) => {
      if (label) {
        if (current[key] === label) return current
        return { ...current, [key]: label }
      }
      if (!(key in current)) return current
      const remaining = { ...current }
      delete remaining[key]
      return remaining
    })
  }, [])
  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel])

  return (
    <BreadcrumbLabelContext value={value}>{children}</BreadcrumbLabelContext>
  )
}

export function useBreadcrumbLabel(key: string, label: string | undefined) {
  const { setLabel } = useContext(BreadcrumbLabelContext)

  useEffect(() => {
    setLabel(key, label ?? null)
    return () => setLabel(key, null)
  }, [key, label, setLabel])
}

const routeLabels: Record<string, string> = {
  attendance: "Attendance",
  my: "Check-Ins",
  adjustments: "Requests & Approvals",
  records: "Records",
  dashboard: "Dashboard",
  profile: "My Profile",
  "billing-logs": "Billing Logs",
  settings: "Settings",
  messages: "Messages",
  projects: "Projects",
  "project-workspace": "Project Workspace",
  "project-management": "Project Workspace",
  accounts: "Account Management",
  departments: "Department Management",
  employees: "Employee Management",
  services: "Services",
  "booked-services": "Booked Services",
  "staff-workload": "Staff Workload",
  "request-inbox": "Request Inbox",
  "service-requests": "Booked Requests",
  help: "Help & Support",
  clients: "Client Management",
}

const contextualRouteLabels: Record<string, Record<string, string>> = {
  module: {
    "project-management": moduleRegistry["project-management"].title,
  },
  "project-management": { logs: getModuleLogsLabel("project-management") },
  "service-operations": { logs: getModuleLogsLabel("service-operations") },
  attendance: {
    my: "Check-Ins",
    "check-ins": "Check-Ins",
    records: "Records",
    adjustments: "Requests & Approvals",
    settings: "Policy Management",
    "time-logs": "Time Logs",
    requests: "Requests & Approvals",
    policies: "Policies",
  },
}

function labelFor(segment: string, parentSegment?: string) {
  const decoded = decodeURIComponent(segment)
  return (
    contextualRouteLabels[parentSegment?.toLowerCase() ?? ""]?.[
      decoded.toLowerCase()
    ] ??
    routeLabels[decoded.toLowerCase()] ??
    decoded
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { labels } = useContext(BreadcrumbLabelContext)
  const segments = pathname.split("/").filter(Boolean)
  const decodedSegments = segments.map(decodeURIComponent)
  const isProjectManagementDepartmentProjects =
    decodedSegments.length === 4 &&
    decodedSegments[0] === "project-management" &&
    decodedSegments[1] === "departments" &&
    decodedSegments[3] === "projects"
  const isWorkspaceDetail =
    decodedSegments.length === 2 &&
    decodedSegments[0] === "project-workspace" &&
    decodedSegments[1] !== "new" &&
    decodedSegments[1] !== "overview"
  const directoryQuery = isWorkspaceDetail
    ? serializeWorkspaceDirectoryState(
        parseWorkspaceDirectoryState(
          new URLSearchParams(searchParams.toString()),
        ),
      )
    : ""

  return (
    <nav
      className="min-w-0 overflow-hidden text-[13px]"
      aria-label="Breadcrumb"
    >
      <ol className="flex min-w-0 list-none gap-[7px] p-0 whitespace-nowrap">
        <li className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]">
          <Link
            href="/"
            className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
          >
            <HomeIcon className="size-[18px]" strokeWidth={1.75} />
            <span className="max-[560px]:sr-only">Home</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const decodedSegment = decodedSegments[index]
          const projectManagementLabel =
            isProjectManagementDepartmentProjects && index === 1
              ? "Management"
              : isProjectManagementDepartmentProjects && index === 3
                ? "Project Workspaces"
                : undefined
          const label =
            projectManagementLabel ??
            labels[segment] ??
            labels[decodedSegment] ??
            (index === 1 && (isWorkspaceDetail || segments[0] === "projects")
              ? "Project"
              : labelFor(segment, segments[index - 1]))
          const isCurrent = index === segments.length - 1
          const isDepartmentContext =
            isProjectManagementDepartmentProjects && index === 2
          const baseHref = `/${segments.slice(0, index + 1).join("/")}`
          const href = isProjectManagementDepartmentProjects
            ? index === 0
              ? "/project-management/overview"
              : "/project-management"
            : index === 0 && directoryQuery
              ? `${baseHref}?${directoryQuery}`
              : baseHref
          return (
            <li
              key={`${index}-${segment}`}
              // Phones show Home › current page only; middle levels would
              // otherwise squeeze into each other.
              className={`flex min-w-0 items-center gap-[7px] text-[#8a9ab3] ${isCurrent ? "" : "max-[560px]:hidden"}`}
            >
              <ChevronRightIcon
                className="size-[18px] flex-none"
                strokeWidth={1.75}
              />
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="min-w-0 truncate font-semibold text-[#253f8c]"
                >
                  {label}
                </span>
              ) : isDepartmentContext ? (
                <span className="block min-w-0 truncate text-[#647a9c]">
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className={`block min-w-0 truncate text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
