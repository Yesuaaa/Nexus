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
  dashboard: "Dashboard",
  profile: "My Profile",
  "billing-logs": "Billing Logs",
  settings: "Settings",
  messages: "Messages",
  projects: "Projects",
  "project-workspace": "Project Workspace",
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

function labelFor(segment: string) {
  const decoded = decodeURIComponent(segment)
  return (
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
    <nav className="min-w-0 overflow-hidden" aria-label="Breadcrumb">
      <ol className="flex min-w-0 list-none gap-[7px] p-0 whitespace-nowrap">
        <li className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]">
          <Link
            href="/"
            className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
          >
            <HomeIcon width="15" height="15" />
            <span className="max-[560px]:sr-only">Home</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const decodedSegment = decodedSegments[index]
          const label =
            labels[segment] ??
            labels[decodedSegment] ??
            (index === 1 && isWorkspaceDetail
              ? "Project"
              : index === 1 && segments[0] === "projects"
                ? "Project"
                : labelFor(segment))
          const isCurrent = index === segments.length - 1
          const baseHref = `/${segments.slice(0, index + 1).join("/")}`
          const href =
            index === 0 && directoryQuery
              ? `${baseHref}?${directoryQuery}`
              : baseHref
          return (
            <li
              key={`${index}-${segment}`}
              // Phones show Home › current page only; middle levels would
              // otherwise squeeze into each other.
              className={`flex min-w-0 items-center gap-[7px] text-[#8a9ab3] ${isCurrent ? "" : "max-[560px]:hidden"}`}
            >
              <ChevronRightIcon width="14" height="14" className="flex-none" />
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="min-w-0 truncate font-semibold text-[#253f8c]"
                >
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
