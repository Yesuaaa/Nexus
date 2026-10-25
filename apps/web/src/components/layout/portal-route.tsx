import { Navigate, Outlet, useLocation, useNavigate } from "react-router"
import { sileo } from "sileo"
import { signOut } from "@/features/auth/api"
import { useAccount } from "@/features/auth/use-account"
import { hasPermission, Permissions } from "@/features/auth/permissions"
import { AppLayout } from "./app-layout"

const stateClassName =
  "grid min-h-dvh place-items-center bg-[var(--portal-canvas)] px-6 text-center text-[#5a6f95]"

export function PortalRoute({
  onReady,
}: {
  onReady?: (succeeded: boolean) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { account, error } = useAccount(onReady)

  async function handleSignOut() {
    try {
      await signOut()
      navigate("/login", { replace: true })
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
  if (
    /^\/accounts\/?$/.test(location.pathname) &&
    !hasPermission(account, Permissions.ACCOUNTS_READ)
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AppLayout account={account} onSignOut={() => void handleSignOut()}>
      <Outlet context={account} />
    </AppLayout>
  )
}
