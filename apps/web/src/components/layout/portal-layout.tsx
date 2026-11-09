"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { sileo } from "@/lib/toast"
import { signOut } from "@/features/auth/api/auth-api"
import { useAccount } from "@/features/auth/hooks/use-account"
import {
  canAccessAccountManagement,
  canAccessBookedServices,
  canAccessRequestInbox,
  canAccessDepartmentManagement,
  canAccessEmployeeManagement,
  canAccessServiceCatalog,
  canAccessServiceManagement,
  canAccessClientManagement,
  canAccessMessages,
  canAccessProjects,
  canAccessProjectWorkspace,
} from "@/features/auth/model/permissions"
import { AccountContext } from "@/features/auth/providers/account-context"
import { useAuthTransition } from "@/features/auth/providers/auth-provider"
import { PreferencesProvider } from "@/features/settings/providers/preferences-provider"
import { BreadcrumbLabelProvider } from "./breadcrumbs"
import { RoleLayout } from "./role-layout"

const stateClassName =
  "grid min-h-dvh place-items-center bg-[var(--portal-canvas)] px-6 text-center text-[#5a6f95]"

export function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { markDestinationReady } = useAuthTransition()
  const { account, error } = useAccount(markDestinationReady)
  const denied =
    !!account &&
    ((pathname.startsWith("/accounts") &&
      !canAccessAccountManagement(account)) ||
      (pathname.startsWith("/messages") && !canAccessMessages(account)) ||
      (pathname.startsWith("/projects") && !canAccessProjects(account)) ||
      (pathname.startsWith("/project-workspace") &&
        !canAccessProjectWorkspace(account)) ||
      (pathname === "/departments" &&
        !canAccessDepartmentManagement(account)) ||
      (pathname.startsWith("/employees") &&
        !canAccessEmployeeManagement(account)) ||
      (pathname === "/services" &&
        !canAccessServiceCatalog(account) &&
        !canAccessServiceManagement(account)) ||
      ((pathname.startsWith("/service-requests") || pathname === "/calendar") &&
        !canAccessServiceCatalog(account)) ||
      (pathname.startsWith("/clients") &&
        !canAccessClientManagement(account)) ||
      (pathname.startsWith("/booked-services") &&
        !canAccessBookedServices(account)) ||
      (pathname.startsWith("/staff-workload") &&
        !canAccessRequestInbox(account)) ||
      (pathname.startsWith("/request-inbox") &&
        !canAccessRequestInbox(account)))

  useEffect(() => {
    if (denied) router.replace("/dashboard")
  }, [denied, router])

  async function handleSignOut() {
    try {
      await signOut()
      router.replace("/login")
      sileo.success({
        title: "Signed out",
        description: "See you next time.",
      })
    } catch {
      sileo.error({
        title: "Couldn't sign out",
        description: "Please try again.",
      })
    }
  }

  if (error)
    return (
      <main className={stateClassName} role="alert">
        {error}
      </main>
    )
  if (!account)
    return (
      <main className={stateClassName} role="status">
        Loading your account…
      </main>
    )
  if (denied) return null

  return (
    <AccountContext value={account}>
      <PreferencesProvider key={account.id}>
        <BreadcrumbLabelProvider>
          <RoleLayout account={account} onSignOut={() => void handleSignOut()}>
            {children}
          </RoleLayout>
        </BreadcrumbLabelProvider>
      </PreferencesProvider>
    </AccountContext>
  )
}
