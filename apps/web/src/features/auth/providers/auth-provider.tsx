"use client"

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import {
  subscribeToasts,
  getToastSnapshot,
  getServerToastSnapshot,
} from "@/lib/toast"
import { getAuthCopy, getStoredAuthLanguage } from "../content/auth-copy"
import { useLoginTransition } from "../hooks/use-login-transition"
import type { AuthMode } from "../model/types"

const ToastViewport = dynamic(
  () =>
    import("../components/toast-viewport").then(
      (module) => module.ToastViewport,
    ),
  { ssr: false },
)

const AuthRouteLoader = dynamic(
  () =>
    import("../components/auth-loader").then(
      (module) => module.AuthRouteLoader,
    ),
  {
    loading: () => (
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-background"
        role="status"
        aria-label="Opening your account"
      >
        <span className="sr-only">Opening your account…</span>
      </div>
    ),
  },
)

type AuthTransition = {
  beginLoginTransition: (mode: AuthMode) => void
  markDestinationReady: (succeeded: boolean) => void
}

const AuthTransitionContext = createContext<AuthTransition | null>(null)

export function useAuthTransition() {
  const context = useContext(AuthTransitionContext)
  if (!context) throw new Error("AuthProvider is required")
  return context
}

// The root layout keeps the login overlay and toasts alive across navigation.
export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const transition = useLoginTransition()
  const showToasts = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getServerToastSnapshot,
  )
  const authPage = pathname === "/login" || pathname === "/register"

  return (
    <AuthTransitionContext
      value={{
        beginLoginTransition: transition.beginLoginTransition,
        markDestinationReady: transition.markDestinationReady,
      }}
    >
      <div className={authPage ? "auth-toast-region" : undefined}>
        {showToasts && <ToastViewport />}
      </div>
      {children}
      {transition.showLoader && (
        <AuthRouteLoader
          destinationReady={transition.destinationReady}
          onNavigate={transition.navigateToDashboard}
          onExited={transition.finishLoginTransition}
          ariaLabel={getAuthCopy(getStoredAuthLanguage()).openingAccount}
        />
      )}
    </AuthTransitionContext>
  )
}
