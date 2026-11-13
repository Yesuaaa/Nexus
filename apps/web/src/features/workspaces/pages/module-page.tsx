"use client"

import { LayoutGrid } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { EmptyState } from "@/components/ui/empty-state"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"
import { getWorkspaceModules } from "../../dashboard/model/workspace-modules"
import { ModuleCard } from "../components/module-card"

export function ModulePage() {
  const account = usePortalAccount()
  const modules = getWorkspaceModules(account)
  if (account.role === "USER") return null

  return (
    <main
      className={cn(contentClass, "px-[clamp(16px,2.1vw,32px)] py-6")}
      aria-label="Workspace selector"
    >
      <PageHeader
        title="Module"
        description="Select a module to continue. Only workspaces available to your account are shown."
        className="justify-center text-center max-[560px]:items-center"
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
          className="mx-auto grid w-full max-w-[1000px] grid-cols-1 gap-5 pt-6 sm:grid-cols-2"
          aria-label="Available workspaces"
        >
          {modules.map((module) => {
            return <ModuleCard key={module.id} module={module} />
          })}
        </section>
      )}
    </main>
  )
}
