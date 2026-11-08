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
import { getProjectWorkspace } from "@/features/project-workspace/api/project-workspace-api"
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
  const { labels } = useContext(BreadcrumbLabelContext)
  const segments = pathname.split("/").filter(Boolean)
  const projectId =
    segments[0] === "project-workspace" && segments[1] !== "new"
      ? segments[1]
      : undefined
  const [projectLabel, setProjectLabel] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    if (!projectId) return
    const controller = new AbortController()
    getProjectWorkspace(projectId, controller.signal)
      .then((project) => {
        if (!controller.signal.aborted)
          setProjectLabel({ id: projectId, name: project.name })
      })
      .catch(() => {
        // Keep the breadcrumb readable when the page reports a load error.
      })
    return () => controller.abort()
  }, [projectId])

  return (
    <nav className="min-w-0 overflow-hidden" aria-label="Breadcrumb">
      <ol className="flex min-w-0 list-none gap-[7px] p-0 whitespace-nowrap">
        <li className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]">
          <Link
            href="/"
            className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
          >
            <HomeIcon width="15" height="15" />
            <span>Home</span>
          </Link>
        </li>
        {segments.map((segment, index) => {
          const label =
            labels[segment] ??
            (index === 1 && projectId
              ? projectLabel?.id === projectId
                ? projectLabel.name
                : "Project"
              : index === 1 && segments[0] === "projects"
                ? "Project"
                : labelFor(segment))
          const isCurrent = index === segments.length - 1
          return (
            <li
              key={`${index}-${segment}`}
              className="flex min-w-0 items-center gap-[7px] text-[#8a9ab3]"
            >
              <ChevronRightIcon width="14" height="14" />
              {isCurrent ? (
                <span
                  aria-current="page"
                  className="overflow-hidden text-ellipsis font-semibold text-[#253f8c]"
                >
                  {label}
                </span>
              ) : (
                <Link
                  href={`/${segments.slice(0, index + 1).join("/")}`}
                  className={`flex items-center gap-[5px] text-[#647a9c] no-underline hover:text-[#203a78] ${focusRing}`}
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
