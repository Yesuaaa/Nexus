"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "sileo"
import { AuthRouteLoader } from "../components/auth-loader"
import { getAuthCopy, getStoredAuthLanguage } from "../content/auth-copy"
import { useLoginTransition } from "../hooks/use-login-transition"
import type { AuthMode } from "../model/types"

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
  const authPage = pathname === "/login" || pathname === "/register"

  return (
    <AuthTransitionContext
      value={{
        beginLoginTransition: transition.beginLoginTransition,
        markDestinationReady: transition.markDestinationReady,
      }}
    >
      <Toaster
        position={authPage ? "bottom-right" : "top-center"}
        options={{
          fill: "#253f8c",
          roundness: 12,
          styles: {
            title: "exp-toast-title",
            description: "exp-toast-description",
          },
        }}
      />
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
