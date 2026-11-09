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
}>({
  preferences: defaultPreferences,
  update: () => {},
  formatters: createDateFormatters(defaultPreferences),
})
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const version = useRef(0)
  const update = useCallback((value: Preferences) => {
    version.current += 1
    setPreferences(value)
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
    return () => controller.abort()
  }, [])
  return (
    <PreferencesContext value={{ preferences, update, formatters }}>
      {children}
    </PreferencesContext>
  )
}
export const usePreferences = () => useContext(PreferencesContext)
export function useDatePreferences() {
  const { preferences, formatters } = usePreferences()
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
  const time = (value: Date | string) => formatters.time.format(new Date(value))
  return {
    formatDate: date,
    formatTime: time,
    formatDateTime: (value: Date | string) => date(value) + ", " + time(value),
  }
}
