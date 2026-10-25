import { useCallback, useState } from "react"
import { useNavigate } from "react-router"
import { sileo } from "sileo"
import { getAuthCopy, getStoredAuthLanguage } from "./copy"

export function useLoginTransition() {
  const navigate = useNavigate()
  const [showLoader, setShowLoader] = useState(false)
  const [destinationReady, setDestinationReady] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)

  const beginLoginTransition = useCallback(() => {
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
        title: copy.welcomeBackToast,
        description: copy.signedInToast,
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
