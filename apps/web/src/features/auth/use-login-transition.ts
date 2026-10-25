import { useCallback, useState } from "react"
import { useNavigate } from "react-router"
import { sileo } from "sileo"
import { getAuthCopy, getStoredAuthLanguage } from "./copy"
import type { AuthMode } from "./types"

export function useLoginTransition() {
  const navigate = useNavigate()
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
    navigate("/dashboard", { replace: true })
  }, [navigate])

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
