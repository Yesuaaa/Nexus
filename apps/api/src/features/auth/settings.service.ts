import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { AuthError } from "./auth.service.js"

export type SettingsPreferences = {
  timeZone: string
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"
  timeFormat: "12h" | "24h"
  workflowNotifications: boolean
}
export const defaultPreferences: SettingsPreferences = {
  timeZone: "Asia/Manila",
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  workflowNotifications: true,
}
export function readPreferences(value: Prisma.JsonValue): SettingsPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...defaultPreferences }
  try {
    return validatePreferences({ ...defaultPreferences, ...value })
  } catch {
    return { ...defaultPreferences }
  }
}
export function validatePreferences(value: unknown): SettingsPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AuthError(400, "Provide valid preferences")
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).some(
      (key) => !Object.hasOwn(defaultPreferences, key),
    ) ||
    typeof record.timeZone !== "string" ||
    record.timeZone.length > 100 ||
    typeof record.dateFormat !== "string" ||
    !["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].includes(record.dateFormat) ||
    typeof record.timeFormat !== "string" ||
    !["12h", "24h"].includes(record.timeFormat) ||
    typeof record.workflowNotifications !== "boolean"
  )
    throw new AuthError(400, "Provide valid preferences")
  try {
    new Intl.DateTimeFormat("en", { timeZone: record.timeZone })
  } catch {
    throw new AuthError(400, "Choose a valid time zone")
  }
  return record as SettingsPreferences
}
export function deviceName(agent: string | null) {
  if (!agent) return "Unknown device"
  const system = /Android/i.test(agent)
    ? "Android"
    : /iPhone|iPad/i.test(agent)
      ? "iOS"
      : /Windows/i.test(agent)
        ? "Windows"
        : /Macintosh/i.test(agent)
          ? "Mac"
          : /Linux/i.test(agent)
            ? "Linux"
            : "Device"
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "Browser"
  return system + " · " + browser
}
export async function getSettings(userId: string, sessionId: string) {
  const prisma = getPrisma()!
  const [user, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { settings: true },
    }),
    prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        userAgent: true,
        approximateLocation: true,
        createdAt: true,
        lastActiveAt: true,
      },
    }),
  ])
  return {
    preferences: readPreferences(user.settings),
    sessions: sessions.map(
      ({ userAgent, approximateLocation, ...session }) => ({
        ...session,
        device: deviceName(userAgent),
        location: approximateLocation,
        current: session.id === sessionId,
      }),
    ),
  }
}
