import { apiRequest } from "@/features/auth/api/auth-api"
export type Preferences = {
  timeZone: string
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"
  timeFormat: "12h" | "24h"
  workflowNotifications: boolean
}
export type Session = {
  id: string
  device: string
  location?: string | null
  createdAt: string
  lastActiveAt: string | null
  current: boolean
}
export type Settings = { preferences: Preferences; sessions: Session[] }
export const defaultPreferences: Preferences = {
  timeZone: "Asia/Manila",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  workflowNotifications: true,
}
export const getSettings = (signal?: AbortSignal) =>
  apiRequest<Settings>("/api/auth/settings", { signal })
export const savePreferences = (preferences: Preferences) =>
  apiRequest<Preferences>("/api/auth/settings", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  })
export const revokeSession = (id: string) =>
  apiRequest<void>("/api/auth/sessions/" + encodeURIComponent(id), {
    method: "DELETE",
  })
export const revokeOtherSessions = () =>
  apiRequest<void>("/api/auth/sessions/revoke-others", { method: "POST" })

export const revokeAllSessions = () =>
  apiRequest<void>("/api/auth/sessions/revoke-all", { method: "POST" })
