import { randomUUID } from "node:crypto"
import { fail } from "../../shared/http-error.js"

type LogWindow = {
  scope: string
  asOf: Date
  from: Date
  to: Date
  sourceSnapshot: string
  matchingIds?: string[]
}

export const maxSearchGroups = 10_000
const maxWindows = 64
const lifetimeMs = 10 * 60 * 1000
const windows = new Map<string, LogWindow & { expiresAt: number }>()

export function readLogWindow(
  token: string,
  scope: string,
  asOf: Date | undefined,
): LogWindow {
  const window = windows.get(token)
  const expired = window && window.expiresAt <= Date.now()
  if (expired) windows.delete(token)
  if (
    !window ||
    expired ||
    window.scope !== scope ||
    window.asOf.getTime() !== asOf?.getTime()
  )
    fail(
      409,
      "This log window is no longer available. Refresh logs to start again.",
    )
  return window
}

export function saveLogWindow(window: LogWindow): string {
  // Entries are ordered by creation time, so the oldest expires or is evicted first.
  const now = Date.now()
  for (const [token, entry] of windows) {
    if (entry.expiresAt > now && windows.size < maxWindows) break
    windows.delete(token)
  }
  const token = randomUUID()
  windows.set(token, { ...window, expiresAt: now + lifetimeMs })
  return token
}
