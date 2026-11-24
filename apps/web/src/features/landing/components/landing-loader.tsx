"use client"

import { useState, useSyncExternalStore, type ReactNode } from "react"
import { ConverynPageLoader } from "@/features/auth/components/auth-loader"

let introCompleted = false

function subscribe() {
  return () => {}
}

function shouldShowLoader() {
  const [navigation] = performance.getEntriesByType("navigation")
  return (
    !introCompleted &&
    navigation instanceof PerformanceNavigationTiming &&
    navigation.type === "navigate" &&
    new URL(navigation.name).pathname === "/"
  )
}

export function LandingLoader({ children }: { children: ReactNode }) {
  const [exited, setExited] = useState(false)
  const showLoader =
    useSyncExternalStore(subscribe, shouldShowLoader, () => true) && !exited

  return (
    <>
      <div className="contents" inert={showLoader}>
        {children}
      </div>
      {showLoader && (
        <ConverynPageLoader
          onExited={() => {
            introCompleted = true
            setExited(true)
          }}
        />
      )}
    </>
  )
}
