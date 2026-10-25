"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getToken } from "../api/auth-api"

export function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace(getToken() ? "/dashboard" : "/login")
  }, [router])

  return null
}
