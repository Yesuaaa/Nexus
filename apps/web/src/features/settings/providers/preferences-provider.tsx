"use client"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import {
  defaultPreferences,
  getSettings,
  type Preferences,
} from "../api/settings-api"

function createDateFormatters(preferences: Preferences) {
  return {
    date: new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: preferences.timeFormat === "12h",
    }),
  }
}

const PreferencesContext = createContext<{
  preferences: Preferences
  update: (value: Preferences) => void
  formatters: ReturnType<typeof createDateFormatters>
  initialized: boolean
}>({
  preferences: defaultPreferences,
  update: () => {},
  formatters: createDateFormatters(defaultPreferences),
  initialized: true,
})
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [initialized, setInitialized] = useState(false)
  const version = useRef(0)
  const update = useCallback((value: Preferences) => {
    version.current += 1
    setPreferences(value)
    setInitialized(true)
  }, [])
  const formatters = useMemo(
    () => createDateFormatters(preferences),
    [preferences],
  )
  useEffect(() => {
    const controller = new AbortController()
    const initialVersion = version.current
    getSettings(controller.signal)
      .then((data) => {
        if (
          !controller.signal.aborted &&
          initialVersion === version.current &&
          data.preferences
        )
          setPreferences(data.preferences)
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setInitialized(true)
      })
    return () => controller.abort()
  }, [])
  return (
    <PreferencesContext
      value={{ preferences, update, formatters, initialized }}
    >
      {children}
    </PreferencesContext>
  )
}
export const usePreferences = () => useContext(PreferencesContext)
export function useDatePreferences() {
  const { preferences, formatters, initialized } = usePreferences()
  const date = (value: Date | string) => {
    const parts = formatters.date.formatToParts(new Date(value))
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value || ""
    const y = part("year"),
      m = part("month"),
      d = part("day")
    return preferences.dateFormat === "YYYY-MM-DD"
      ? y + "-" + m + "-" + d
      : preferences.dateFormat === "DD/MM/YYYY"
        ? d + "/" + m + "/" + y
        : m + "/" + d + "/" + y
  }
  const dateOnly = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return value
    const [, year, month, day] = match
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      return value
    return preferences.dateFormat === "YYYY-MM-DD"
      ? value
      : preferences.dateFormat === "DD/MM/YYYY"
        ? `${day}/${month}/${year}`
        : `${month}/${day}/${year}`
  }
  const time = (value: Date | string) => formatters.time.format(new Date(value))
  return {
    preferencesLoaded: initialized,
    timeZone: preferences.timeZone,
    formatDate: date,
    formatDateOnly: dateOnly,
    formatTime: time,
    formatDateTime: (value: Date | string) => date(value) + ", " + time(value),
  }
}
