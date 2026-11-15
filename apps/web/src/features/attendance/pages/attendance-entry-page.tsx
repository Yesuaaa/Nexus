"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { usePortalAccount } from "@/features/auth/providers/account-context"
import { canAccessPersonalAttendance } from "@/features/auth/model/permissions"

export function AttendanceEntryPage() {
  const account = usePortalAccount()
  const router = useRouter()
  useEffect(() => {
    router.replace(
      canAccessPersonalAttendance(account)
        ? "/attendance/check-ins"
        : "/attendance/dashboard",
    )
  }, [account, router])
  return <p role="status">Opening attendance…</p>
}
