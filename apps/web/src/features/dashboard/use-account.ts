import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
} from "@/features/auth/api"
import type { Account } from "@/features/auth/types"

export function useAccount(onReady?: (succeeded: boolean) => void) {
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!getToken()) {
      onReady?.(false)
      navigate("/login", { replace: true })
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
          navigate("/login", { replace: true })
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
  }, [navigate, onReady])

  return { account, error }
}
