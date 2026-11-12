"use client"

import Link from "next/link"
import {
  ArrowRight,
  BriefcaseBusiness,
  FolderKanban,
  LayoutGrid,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import {
  getWorkspaceModules,
  type WorkspaceModule,
} from "../model/workspace-modules"

const moduleIcons: Record<WorkspaceModule["id"], LucideIcon> = {
  "service-operations": BriefcaseBusiness,
  "project-management": FolderKanban,
  "people-hr": UsersRound,
  administration: ShieldCheck,
}

export function DashboardPage() {
  const account = usePortalAccount()
  const modules = getWorkspaceModules(account)

  if (account.role === "USER") {
    return (
      <main
        className={cn(contentClass, "px-[clamp(16px,2.1vw,32px)] py-6")}
        aria-label="Client dashboard"
      >
        <PageHeader
          tone="client"
          title="Dashboard"
          description="Access your services, requests, projects, and calendar from the navigation menu."
        />
      </main>
    )
  }

  return (
    <main
      className={cn(contentClass, "px-[clamp(16px,2.1vw,32px)] py-6")}
      aria-label="Workspace selector"
    >
      <PageHeader
        title="Choose a workspace"
        description="Select a module to continue. Only workspaces available to your account are shown."
      />

      {modules.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No workspaces available"
          description="Your account does not currently have access to a workspace. Contact an administrator if you believe this is incorrect."
          size="lg"
          role="status"
          className="mt-6 max-w-[960px]"
        />
      ) : (
        <section
          className="grid max-w-[960px] grid-cols-1 gap-4 pt-6 md:grid-cols-2"
          aria-label="Available workspaces"
        >
          {modules.map((module) => {
            const ModuleIcon = moduleIcons[module.id]
            return (
              <Link
                key={module.id}
                href={module.href}
                aria-label={`Open ${module.title} workspace`}
                className="group flex min-h-[210px] flex-col rounded-xl border border-[#dce3ee] bg-background p-5 text-foreground no-underline shadow-[0_1px_2px_rgb(31_55_94_/_4%)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[#9eb0d2] hover:shadow-[0_8px_24px_rgb(31_55_94_/_10%)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#294a9b] motion-reduce:transform-none motion-reduce:transition-none sm:p-6"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-[#eef3ff] text-[#294a9b]">
                  <ModuleIcon size={22} strokeWidth={1.8} />
                </span>
                <h2 className="mt-5 text-lg leading-tight font-semibold tracking-[-0.02em]">
                  {module.title}
                </h2>
                <p className="mt-2 max-w-[40ch] text-sm leading-6 text-[#68778f]">
                  {module.description}
                </p>
                <span className="mt-auto flex items-center gap-2 pt-5 text-xs font-semibold text-[#294a9b]">
                  Open workspace
                  <ArrowRight
                    size={16}
                    strokeWidth={1.8}
                    className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                </span>
              </Link>
            )
          })}
        </section>
      )}
    </main>
  )
}
