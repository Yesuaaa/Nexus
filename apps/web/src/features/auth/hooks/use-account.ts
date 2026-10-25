import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
} from "../api/auth-api"
import type { Account } from "../model/types"

export function useAccount(onReady?: (succeeded: boolean) => void) {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!getToken()) {
      onReady?.(false)
      router.replace("/login")
      return
    }

    let active = true
    getCurrentAccount()
      .then(({ user }) => {
        if (active) {
          setAccount(user)
          onReady?.(true)
        }
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          clearToken()
          router.replace("/login")
        } else {
          setError(
            "We couldn't load your account. Please refresh to try again.",
          )
        }
        onReady?.(false)
      })

    return () => {
      active = false
    }
  }, [router, onReady])

  return { account, error }
}
