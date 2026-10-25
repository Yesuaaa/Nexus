import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "sileo"
import { getAuthCopy, getStoredAuthLanguage } from "../content/auth-copy"
import type { AuthMode } from "../model/types"

export function useLoginTransition() {
  const router = useRouter()
  const [showLoader, setShowLoader] = useState(false)
  const [destinationReady, setDestinationReady] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)
  const [transitionMode, setTransitionMode] = useState<AuthMode>("login")

  const beginLoginTransition = useCallback((mode: AuthMode) => {
    setTransitionMode(mode)
    setDestinationReady(false)
    setLoginSucceeded(false)
    setShowLoader(true)
  }, [])

  const markDestinationReady = useCallback((succeeded: boolean) => {
    setLoginSucceeded(succeeded)
    setDestinationReady(true)
  }, [])

  const navigateToDashboard = useCallback(() => {
    router.replace("/dashboard")
  }, [router])

  function finishLoginTransition() {
    setShowLoader(false)
    if (loginSucceeded) {
      const copy = getAuthCopy(getStoredAuthLanguage())
      sileo.success({
        title:
          transitionMode === "register"
            ? copy.accountCreated
            : copy.welcomeBackToast,
        description:
          transitionMode === "register"
            ? copy.welcomeToExp
            : copy.signedInToast,
        position: "top-center",
      })
    }
  }

  return {
    showLoader,
    destinationReady,
    beginLoginTransition,
    markDestinationReady,
    navigateToDashboard,
    finishLoginTransition,
  }
}
