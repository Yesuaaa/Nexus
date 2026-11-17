"use client"

import { PageHeader } from "@/components/layout/page-header"
import { contentClass } from "@/components/layout/styles"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { cn } from "@/lib/utils"

export function DashboardPage() {
  const account = usePortalAccount()
  if (account.role !== "USER") return null
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
