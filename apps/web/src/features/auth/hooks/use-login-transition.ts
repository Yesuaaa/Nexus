import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { sileo } from "@/lib/toast"
import { getAuthCopy, getStoredAuthLanguage } from "../content/auth-copy"
import { landingPathForRole } from "../model/auth-portal"
import type { Role } from "../model/roles"
import type { AuthMode } from "../model/types"

export function useLoginTransition() {
  const router = useRouter()
  const [transition, setTransition] = useState<{
    mode: AuthMode
    destination: ReturnType<typeof landingPathForRole>
  } | null>(null)
  const [destinationReady, setDestinationReady] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)

  const beginLoginTransition = useCallback((mode: AuthMode, role: Role) => {
    setDestinationReady(false)
    setLoginSucceeded(false)
    setTransition({ mode, destination: landingPathForRole(role) })
  }, [])

  const markDestinationReady = useCallback((succeeded: boolean) => {
    setLoginSucceeded(succeeded)
    setDestinationReady(true)
  }, [])

  const navigateToDestination = useCallback(() => {
    if (transition) router.replace(transition.destination)
  }, [router, transition])

  function finishLoginTransition() {
    setTransition(null)
    if (transition && loginSucceeded) {
      const copy = getAuthCopy(getStoredAuthLanguage())
      sileo.success({
        title:
          transition.mode === "register"
            ? copy.accountCreated
            : copy.welcomeBackToast,
        description:
          transition.mode === "register"
            ? copy.welcomeToExp
            : copy.signedInToast,
        position: "top-center",
      })
    }
  }

  return {
    showLoader: transition !== null,
    destinationReady,
    beginLoginTransition,
    markDestinationReady,
    navigateToDestination,
    finishLoginTransition,
  }
}
