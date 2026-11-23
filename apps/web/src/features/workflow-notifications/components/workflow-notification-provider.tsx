"use client"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { usePreferences } from "@/features/settings/providers/preferences-provider"
import { apiRequest } from "@/features/auth/api/auth-api"
import { watchVisibleRefresh } from "@/lib/visible-refresh"
type Notification = {
  id: string
  requestId: string | null
  summary: string
  type: string
  entityId: string | null
  createdAt: string
  readAt: string | null
}
type Notifications = { notifications: Notification[]; unreadCount: number }

const Inbox = createContext<{
  result: Notifications | null
  error: boolean
  load: () => Promise<void>
} | null>(null)
export function useWorkflowInbox() {
  const inbox = useContext(Inbox)
  if (!inbox) throw new Error("Workflow notification provider is required")
  return inbox
}
export function WorkflowNotificationProvider({
  children,
}: {
  children: ReactNode
}) {
  const { preferences } = usePreferences()
  const [result, setResult] = useState<Notifications | null>(null)
  const [error, setError] = useState(false)
  const revision = useRef(0)
  const load = useCallback(async (signal?: AbortSignal) => {
    const request = ++revision.current
    try {
      const value = await apiRequest<Notifications>(
        "/api/request-workflows/notifications",
        { signal },
      )
      if (
        !Array.isArray(value?.notifications) ||
        !Number.isSafeInteger(value.unreadCount) ||
        value.unreadCount < 0
      ) {
        throw new Error("Unexpected notification data")
      }
      if (!signal?.aborted && request === revision.current) {
        const ids = new Set<string>()
        const notifications = value.notifications.filter((item) => {
          if (
            !item ||
            typeof item.id !== "string" ||
            typeof item.type !== "string" ||
            typeof item.summary !== "string" ||
            typeof item.createdAt !== "string" ||
            !Number.isFinite(Date.parse(item.createdAt)) ||
            ids.has(item.id)
          )
            return false
          ids.add(item.id)
          return true
        })
        setResult({ ...value, notifications })
        setError(false)
      }
    } catch {
      if (!signal?.aborted && request === revision.current) {
        setResult(null)
        setError(true)
      }
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    let loading = false
    const refresh = () => {
      if (loading) return
      loading = true
      void load(controller.signal).finally(() => {
        loading = false
      })
    }
    void Promise.resolve().then(refresh)
    const stopRefresh = watchVisibleRefresh(refresh, { intervalMs: 30_000 })
    return () => {
      controller.abort()
      stopRefresh()
    }
  }, [load, preferences.workflowNotifications])
  return (
    <Inbox.Provider value={{ result, error, load }}>{children}</Inbox.Provider>
  )
}
