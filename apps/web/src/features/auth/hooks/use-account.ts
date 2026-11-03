import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
} from "../api/auth-api"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
import type { Account } from "../model/types"
export function useAccount(onReady?: (succeeded: boolean) => void) {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true,
      inFlight = false,
      loaded = false,
      revoked = false
    const revoke = () => {
      if (!active || revoked) return
      revoked = true
      clearToken()
      setAccount(null)
      onReady?.(false)
      router.replace("/login")
    }
    const refresh = async () => {
      if (!active || revoked || inFlight) return
      if (!getToken()) {
        revoke()
        return
      }
      inFlight = true
      try {
        const { user } = await getCurrentAccount()
        if (active && !revoked) {
          setAccount(user)
          setError("")
          if (!loaded) {
            loaded = true
            onReady?.(true)
          }
        }
      } catch (reason) {
        if (!active) return
        if (
          (reason instanceof ApiError && reason.status === 401) ||
          !getToken()
        ) {
          revoke()
        } else if (!loaded) {
          setError(
            "We couldn’t load your account. Please refresh to try again.",
          )
          onReady?.(false)
        }
      } finally {
        inFlight = false
      }
    }
    void refresh()
    const stop = watchVisibleRefresh(() => void refresh())
    const accountUpdated = () => void refresh()
    window.addEventListener("nexus:account-updated", accountUpdated)
    return () => {
      active = false
      stop()
      window.removeEventListener("nexus:account-updated", accountUpdated)
    }
  }, [router, onReady])
  return { account, error }
}
