"use client"

import { LayoutGrid } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { getWorkspaceModules } from "../../dashboard/model/workspace-modules"
import { ModuleCarousel } from "../components/module-carousel"

export function ModulePage() {
  const account = usePortalAccount()
  const modules = getWorkspaceModules(account)
  if (account.role === "USER") return null

  return (
    <main
      className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-[13px] border border-[#dedede] bg-background px-[clamp(16px,2.1vw,32px)] py-6 max-[767px]:mt-1.5"
      aria-label="Workspace selector"
    >
      <PageHeader
        title="Module"
        description="Select a module to continue. Only workspaces available to your account are shown."
        className="justify-center text-center max-[560px]:items-center [&>div>h1]:text-[clamp(28px,3vw,36px)] [&>div>p]:text-sm"
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
        <div className="-mx-[clamp(16px,2.1vw,32px)] flex min-h-0 flex-1">
          <ModuleCarousel modules={modules} />
        </div>
      )}
    </main>
  )
}
