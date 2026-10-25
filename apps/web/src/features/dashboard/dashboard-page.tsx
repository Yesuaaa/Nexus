import { useNavigate } from "react-router"
import { sileo } from "sileo"
import { signOut } from "@/features/auth/api"
import { AppLayout } from "@/components/layout/app-layout"
import { useAccount } from "./use-account"

const stateClassName =
  "grid min-h-dvh place-items-center bg-[#f7f9fc] px-6 text-center text-[#5a6f95]"

export function DashboardPage({
  onReady,
}: {
  onReady?: (succeeded: boolean) => void
}) {
  const navigate = useNavigate()
  const { account, error } = useAccount(onReady)

  async function handleSignOut() {
    try {
      await signOut()
      navigate("/login", { replace: true })
      sileo.success({ title: "Signed out", description: "See you next time." })
    } catch {
      sileo.error({
        title: "Couldn't sign out",
        description: "Please try again.",
      })
    }
  }

  if (error) {
    return (
      <main className={stateClassName} role="alert">
        {error}
      </main>
    )
  }

  if (!account) {
    return (
      <main className={stateClassName} role="status">
        Loading your account…
      </main>
    )
  }

  return (
    <AppLayout role={account.role} onSignOut={() => void handleSignOut()}>
      <main className="app-content" aria-label="Dashboard" />
    </AppLayout>
  )
}
