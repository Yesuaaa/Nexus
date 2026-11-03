"use client"
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react"
import {
  defaultPreferences,
  getSettings,
  type Preferences,
} from "../api/settings-api"
const PreferencesContext = createContext<{
  preferences: Preferences
  update: (value: Preferences) => void
}>({
  preferences: defaultPreferences,
  update: () => {},
})
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const version = useRef(0)
  const update = useCallback((value: Preferences) => {
    version.current += 1
    setPreferences(value)
  }, [])
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
    <PreferencesContext value={{ preferences, update }}>
      {children}
    </PreferencesContext>
  )
}
export const usePreferences = () => useContext(PreferencesContext)
export function useDatePreferences() {
  const { preferences } = usePreferences()
  const date = (value: Date | string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value))
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
  const time = (value: Date | string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: preferences.timeFormat === "12h",
    }).format(new Date(value))
  return {
    formatDate: date,
    formatTime: time,
    formatDateTime: (value: Date | string) => date(value) + ", " + time(value),
  }
}
