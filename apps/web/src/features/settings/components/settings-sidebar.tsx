"use client"
import { useEffect, useState } from "react"
import { KeyRound, Monitor, Bell, ChevronRight, Clock3 } from "lucide-react"
import type { Preferences, Session } from "../api/settings-api"
const panelClass = "rounded-xl border border-[#dfe6f0] bg-background p-5"
function preview(value: Date, preferences: Preferences) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: preferences.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || ""
  const y = part("year"),
    m = part("month"),
    d = part("day")
  const date =
    preferences.dateFormat === "YYYY-MM-DD"
      ? y + "-" + m + "-" + d
      : preferences.dateFormat === "DD/MM/YYYY"
        ? d + "/" + m + "/" + y
        : m + "/" + d + "/" + y
  return {
    date,
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: preferences.timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: preferences.timeFormat === "12h",
    }).format(value),
  }
}
export function SettingsSidebar({
  tab,
  preferences,
  sessions,
  loading,
  dirty,
  onAction,
}: {
  tab: string
  preferences: Preferences
  sessions: Session[]
  loading: boolean
  dirty: boolean
  onAction: (action: "password" | "sessions" | "notifications") => void
}) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0)
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [])
  const current = sessions.find((session) => session.current)
  const display = now ? preview(now, preferences) : null
  return (
    <aside
      aria-label="Account settings overview"
      className="grid min-w-0 content-start gap-4"
    >
      <section className={panelClass}>
        <h2 className="m-0 text-sm font-semibold text-[#182235]">
          Account shortcuts
        </h2>
        <div className="mt-3 grid gap-1">
          {[
            {
              action: "password" as const,
              title: "Change password",
              hint: "Update your account password",
              Icon: KeyRound,
            },
            {
              action: "sessions" as const,
              title: "Active sessions",
              hint: "Manage where you’re signed in",
              Icon: Monitor,
            },
            {
              action: "notifications" as const,
              title: "Notification settings",
              hint: "Choose which updates you receive",
              Icon: Bell,
            },
          ].map(({ action, title, hint, Icon }) => (
            <button
              key={action}
              type="button"
              aria-label={"Shortcut: " + title.toLowerCase()}
              onClick={() => onAction(action)}
              className="flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-1 py-3 text-left hover:bg-[#f3f6fb] focus-visible:outline-2 focus-visible:outline-[#294a9b]"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#eef3fb] text-[#667b9e]">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[#182235]">
                  {title}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-[#738096]">
                  {hint}
                </span>
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 text-[#8a9ab3]"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </section>
      {tab === "security" && (
        <section className={panelClass}>
          <h2 className="m-0 text-sm font-semibold">Account protection</h2>
          <dl className="mt-5 mb-0 grid gap-4 text-xs">
            <div>
              <dt className="text-[#738096]">Active sessions</dt>
              <dd className="mt-1 ml-0 font-medium">
                {loading ? "Loading…" : sessions.length + " signed in"}
              </dd>
            </div>
            <div>
              <dt className="text-[#738096]">This browser</dt>
              <dd className="mt-1 ml-0 leading-5">
                {loading
                  ? "Loading…"
                  : current?.device || "Session information unavailable"}
              </dd>
              {current?.location && (
                <dd className="mt-1 ml-0 text-[11px] text-[#738096]">
                  {current.location}
                </dd>
              )}
            </div>
          </dl>
          <p className="mt-5 mb-0 border-t border-[#e7ecf3] pt-4 text-[11px] leading-5 text-[#738096]">
            After changing your password, you can choose whether to log out of
            all devices.
          </p>
        </section>
      )}
      {tab === "notifications" && (
        <>
          <section className={panelClass}>
            <h2 className="m-0 text-sm font-semibold">Current settings</h2>
            <p className="mt-4 mb-1 text-lg font-semibold text-[#203f8c]">
              {preferences.workflowNotifications
                ? "Updates enabled"
                : "Updates muted"}
            </p>
            <p className="m-0 text-xs leading-5 text-[#738096]">
              Workflow updates in your notification bell
            </p>
            <p className="mt-4 mb-0 border-t border-[#e7ecf3] pt-4 text-[11px] leading-5 text-[#738096]">
              {dirty
                ? "You have unsaved changes."
                : "Your notification preferences are saved."}
            </p>
          </section>
          <section className={panelClass}>
            <h2 className="m-0 text-sm font-semibold">About notifications</h2>
            <p className="mt-3 mb-0 text-xs leading-6 text-[#738096]">
              Account access and security messages remain enabled.
            </p>
          </section>
        </>
      )}
      {tab === "preferences" && (
        <>
          <section className={panelClass}>
            <h2 className="m-0 text-sm font-semibold">Your preferences</h2>
            <dl className="mt-5 mb-0 grid gap-4 text-xs">
              {[
                ["Time zone", preferences.timeZone.replaceAll("_", " ")],
                ["Date format", preferences.dateFormat],
                [
                  "Time format",
                  preferences.timeFormat === "12h"
                    ? "12-hour (AM/PM)"
                    : "24-hour",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[#738096]">{label}</dt>
                  <dd className="mt-1 ml-0 font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {dirty && (
              <p className="mt-4 mb-0 border-t border-[#e7ecf3] pt-4 text-[11px] text-[#738096]">
                Previewing unsaved changes.
              </p>
            )}
          </section>
          <section className={panelClass}>
            <h2 className="m-0 flex items-center gap-2 text-sm font-semibold">
              <Clock3 size={16} className="text-[#203f8c]" aria-hidden="true" />
              Time preview
            </h2>
            <p className="mt-4 mb-1 text-2xl font-semibold text-[#182235]">
              {display?.time || "—"}
            </p>
            <p className="m-0 text-xs leading-5 text-[#738096]">
              {display?.date || "—"}
            </p>
            <p className="mt-3 mb-0 text-[11px] leading-5 text-[#738096]">
              {preferences.timeZone.replaceAll("_", " ")}
            </p>
          </section>
        </>
      )}
    </aside>
  )
}
