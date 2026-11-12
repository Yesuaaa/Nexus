"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { sileo } from "@/lib/toast"
import { signOut } from "@/features/auth/api/auth-api"
import { useAccount } from "@/features/auth/hooks/use-account"
import { loginPathForRole } from "@/features/auth/model/auth-portal"
import { AccountContext } from "@/features/auth/providers/account-context"
import { useAuthTransition } from "@/features/auth/providers/auth-provider"
import { PreferencesProvider } from "@/features/settings/providers/preferences-provider"
import { isRouteDenied } from "@/features/workspaces/model/route-policy"
import { BreadcrumbLabelProvider } from "./breadcrumbs"
import { RoleLayout } from "./role-layout"

const stateClassName =
  "grid min-h-dvh place-items-center bg-[var(--portal-canvas)] px-6 text-center text-[#5a6f95]"

export function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { markDestinationReady } = useAuthTransition()
  const { account, error } = useAccount(markDestinationReady)
  const denied = !!account && isRouteDenied(account, pathname)

  useEffect(() => {
    if (denied) router.replace("/dashboard")
  }, [denied, router])

  async function handleSignOut() {
    const loginPath = loginPathForRole(account?.role ?? "USER")
    try {
      await signOut()
      router.replace(loginPath)
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
