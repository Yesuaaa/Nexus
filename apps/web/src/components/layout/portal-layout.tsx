"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { sileo } from "sileo"
import { signOut } from "@/features/auth/api/auth-api"
import { useAccount } from "@/features/auth/hooks/use-account"
import {
  canAccessDepartmentManagement,
  canAccessEmployeeManagement,
  hasPermission,
  Permissions,
} from "@/features/auth/model/permissions"
import { AccountContext } from "@/features/auth/providers/account-context"
import { useAuthTransition } from "@/features/auth/providers/auth-provider"
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
    ((pathname === "/accounts" &&
      !hasPermission(account, Permissions.ACCOUNTS_READ)) ||
      (pathname === "/departments" &&
        !canAccessDepartmentManagement(account)) ||
      (pathname.startsWith("/employees") &&
        !canAccessEmployeeManagement(account)))

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
        position: "bottom-right",
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
      <RoleLayout account={account} onSignOut={() => void handleSignOut()}>
        {children}
      </RoleLayout>
    </AccountContext>
  )
}
