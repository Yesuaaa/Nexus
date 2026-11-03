"use client"
import { useEffect, useState, type FormEvent } from "react"
import {
  Bell,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  KeyRound,
} from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { SettingsSidebar } from "../components/settings-sidebar"
import { SecurityDetails } from "../components/security-details"
import {
  getSettings,
  savePreferences,
  revokeSession,
  revokeOtherSessions,
  type Preferences,
  type Session,
} from "../api/settings-api"
import {
  usePreferences,
  useDatePreferences,
} from "../providers/preferences-provider"
const inputClass =
  "min-h-11 w-full rounded-lg border border-[#d8e1ef] bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#294a9b]"
const primaryClass = "min-h-11 bg-[#203f8c] text-white hover:bg-[#172f70]"
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Please try again."
export function SettingsPage() {
  const { preferences, update } = usePreferences()
  const { formatDateTime } = useDatePreferences()
  const [draft, setDraft] = useState<Preferences | null>(null)
  const [original, setOriginal] = useState<Preferences | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(false)
  const [target, setTarget] = useState<Session | "others" | null>(null)
  const [sessionError, setSessionError] = useState("")
  const [tab, setTab] = useState("security")
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  useEffect(() => {
    if (!focusTarget) return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(focusTarget)
      target?.scrollIntoView({ block: "nearest", behavior: "instant" })
      target?.focus({ preventScroll: true })
      setFocusTarget(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [focusTarget, tab])
  function shortcut(action: "password" | "sessions" | "notifications") {
    if (action === "password") {
      setPasswordOpen(true)
      return
    }
    setTab(action === "sessions" ? "security" : "notifications")
    setFocusTarget(
      action === "sessions" ? "active-sessions" : "notification-settings",
    )
  }
  useEffect(() => {
    const controller = new AbortController()
    getSettings(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSessions(data.sessions)
          setDraft(data.preferences)
          setOriginal(data.preferences)
          update(data.preferences)
          setError("")
          setLoading(false)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(message(reason))
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [revision, update])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    setSaving(true)
    setError("")
    try {
      const result = await savePreferences(draft)
      setDraft(result)
      setOriginal(result)
      update(result)
      sileo.success({ title: "Settings saved" })
    } catch (reason) {
      setError(message(reason))
    } finally {
      setSaving(false)
    }
  }
  async function endSession() {
    if (!target) return
    setPending(true)
    setSessionError("")
    try {
      if (target === "others") await revokeOtherSessions()
      else await revokeSession(target.id)
      setSessions((current) =>
        current.filter((session) =>
          target === "others" ? session.current : session.id !== target.id,
        ),
      )
      setTarget(null)
      sileo.success({ title: "Session signed out" })
    } catch (reason) {
      setSessionError(message(reason))
    } finally {
      setPending(false)
    }
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(original)
  return (
    <main className="mt-4 min-w-0 rounded-2xl border border-[#e1e6ee] bg-background p-5 text-[#182235] sm:p-8">
      <header className="mb-6">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 mb-0 text-sm text-[#667b9e]">
          Manage your security, notifications, and preferences.
        </p>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          aria-label="Settings sections"
          className="mb-6 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-[#e1e6ee] bg-transparent p-0"
        >
          {[
            { id: "security", label: "Security", Icon: ShieldCheck },
            { id: "notifications", label: "Notifications", Icon: Bell },
            {
              id: "preferences",
              label: "Preferences",
              Icon: SlidersHorizontal,
            },
          ].map(({ id, label, Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="min-h-12 gap-2 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-[#203f8c] data-[state=active]:bg-transparent data-[state=active]:text-[#203f8c] data-[state=active]:shadow-none sm:px-5"
            >
              <Icon
                size={16}
                aria-hidden="true"
                className="hidden min-[400px]:block"
              />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {error && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-[#efc9cf] p-4 text-sm text-[#a42f40]"
          >
            {error}
            {!draft && (
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true)
                  setRevision((value) => value + 1)
                }}
              >
                Try again
              </Button>
            )}
          </div>
        )}
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,2.3fr)_minmax(250px,1fr)]">
          <div className="min-w-0">
            <TabsContent value="security" className="m-0">
              <div className="grid gap-4">
                <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dfe6f0] bg-[#f8faff] p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf2fa] text-[#667b9e]">
                      <KeyRound size={17} aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="m-0 text-sm font-semibold">Password</h2>
                      <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                        Keep your account password secure and up to date.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 text-xs"
                    onClick={() => setPasswordOpen(true)}
                  >
                    Change password
                  </Button>
                </section>
                <section
                  id="active-sessions"
                  tabIndex={-1}
                  className="rounded-xl border border-[#dfe6f0] p-5 focus-visible:outline-2 focus-visible:outline-[#294a9b]"
                >
                  <h2 className="m-0 text-sm font-semibold">Active sessions</h2>
                  <p className="mt-2 mb-6 text-xs leading-5 text-[#738096]">
                    Review where you’re signed in. End a session you don’t
                    recognize.
                  </p>
                  {loading ? (
                    <p role="status" className="text-sm">
                      Loading sessions…
                    </p>
                  ) : sessions.length ? (
                    <ul className="m-0 list-none divide-y divide-[#e1e6ee] p-0">
                      {sessions.map((session) => (
                        <li
                          key={session.id}
                          className="flex flex-wrap items-start gap-3 py-4 first:pt-0"
                        >
                          <Monitor
                            size={18}
                            className="mt-1 shrink-0 text-[#667b9e]"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="m-0 break-words text-sm font-medium">
                              {session.device}
                            </p>
                            <p className="mt-1 mb-0 text-xs leading-5 text-[#738096]">
                              {session.location
                                ? `${session.location} · Approximate location`
                                : "Location unavailable"}
                            </p>
                            {session.current && (
                              <span className="mt-1 inline-block text-xs font-medium text-[#23724d]">
                                Current session
                              </span>
                            )}
                            <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
                              {session.lastActiveAt
                                ? "Last active " +
                                  formatDateTime(session.lastActiveAt)
                                : "Signed in " +
                                  formatDateTime(session.createdAt)}
                            </p>
                          </div>
                          {!session.current && (
                            <Button
                              variant="outline"
                              className="min-h-10 text-xs"
                              onClick={() => {
                                setSessionError("")
                                setTarget(session)
                              }}
                            >
                              Sign out
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#738096]">
                      No active sessions to display.
                    </p>
                  )}
                  <div className="mt-5 border-t border-[#e1e6ee] pt-5">
                    <Button
                      variant="outline"
                      className="min-h-11 w-full border-[#bc3649] text-xs text-[#bc3649] hover:bg-[#fff0f1] hover:text-[#9f2638] focus-visible:ring-[#bc3649]"
                      disabled={
                        loading || !sessions.some((session) => !session.current)
                      }
                      onClick={() => {
                        setSessionError("")
                        setTarget("others")
                      }}
                    >
                      Sign out all other sessions
                    </Button>
                    <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
                      You’ll stay signed in on this browser.
                    </p>
                  </div>
                </section>
              </div>
            </TabsContent>
            <TabsContent value="notifications" className="m-0">
              <form onSubmit={save} className="grid gap-6">
                <section
                  id="notification-settings"
                  tabIndex={-1}
                  className="rounded-xl border border-[#dfe6f0] bg-[#f8faff] p-5 focus-visible:outline-2 focus-visible:outline-[#294a9b]"
                >
                  <h2 className="m-0 text-base font-semibold">
                    In-app notifications
                  </h2>
                  <p className="mt-2 mb-5 text-xs leading-5 text-[#738096]">
                    Choose whether request and project updates appear in your
                    notification bell.
                  </p>
                  <label className="flex cursor-pointer items-start justify-between gap-5 border-t border-[#e1e6ee] pt-5">
                    <span>
                      <span className="block text-sm font-medium">
                        Workflow updates
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#738096]">
                        Updates to requests, quotations, agreements, payments,
                        and project activation relevant to your account.
                      </span>
                    </span>
                    <span className="relative mt-1 inline-flex shrink-0">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Workflow updates"
                        checked={
                          draft?.workflowNotifications ??
                          preferences.workflowNotifications
                        }
                        disabled={!draft || saving}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  workflowNotifications: event.target.checked,
                                }
                              : current,
                          )
                        }
                        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
                      />
                      <span
                        aria-hidden="true"
                        className="inline-flex h-6 w-10 items-center rounded-full bg-[#cbd5e3] p-1 transition-colors peer-checked:bg-[#203f8c] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#294a9b] peer-checked:[&>span]:translate-x-4"
                      >
                        <span className="size-4 rounded-full bg-white transition-transform motion-reduce:transition-none" />
                      </span>
                    </span>
                  </label>
                </section>

                <div className="flex justify-end">
                  <Button
                    className={primaryClass}
                    disabled={!draft || !dirty || saving}
                  >
                    {saving ? "Saving…" : "Save notifications"}
                  </Button>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="preferences" className="m-0 max-w-3xl">
              <form onSubmit={save} className="grid gap-6">
                <section className="grid gap-4">
                  <div>
                    <h2 className="m-0 text-base font-semibold">
                      Date and time
                    </h2>
                    <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
                      Choose how dates and times appear in conversations and
                      notifications.
                    </p>
                  </div>
                  <fieldset
                    disabled={!draft || saving}
                    className="m-0 grid min-w-0 gap-5 border-0 p-0"
                  >
                    <label className="grid gap-2 rounded-lg border border-[#dfe6f0] bg-[#f8faff] p-4 text-xs font-medium text-[#52627a]">
                      Time zone
                      <select
                        className={inputClass}
                        value={draft?.timeZone || preferences.timeZone}
                        onChange={(event) =>
                          setDraft((current) =>
                            current
                              ? { ...current, timeZone: event.target.value }
                              : current,
                          )
                        }
                      >
                        {Array.from(
                          new Set([
                            draft?.timeZone || preferences.timeZone,
                            "UTC",
                            ...Intl.supportedValuesOf("timeZone"),
                          ]),
                        ).map((zone) => (
                          <option key={zone} value={zone}>
                            {zone.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4">
                      <label className="grid gap-2 rounded-lg border border-[#dfe6f0] bg-[#f8faff] p-4 text-xs font-medium text-[#52627a]">
                        Date format
                        <select
                          className={inputClass}
                          value={draft?.dateFormat || preferences.dateFormat}
                          onChange={(event) =>
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    dateFormat: event.target
                                      .value as Preferences["dateFormat"],
                                  }
                                : current,
                            )
                          }
                        >
                          {["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map(
                            (format) => (
                              <option key={format}>{format}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="grid gap-2 rounded-lg border border-[#dfe6f0] bg-[#f8faff] p-4 text-xs font-medium text-[#52627a]">
                        Time format
                        <select
                          className={inputClass}
                          value={draft?.timeFormat || preferences.timeFormat}
                          onChange={(event) =>
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    timeFormat: event.target
                                      .value as Preferences["timeFormat"],
                                  }
                                : current,
                            )
                          }
                        >
                          <option value="12h">12-hour (AM/PM)</option>
                          <option value="24h">24-hour</option>
                        </select>
                      </label>
                    </div>
                  </fieldset>
                </section>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={!dirty || saving}
                    onClick={() => setDraft(original)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className={primaryClass}
                    disabled={!draft || !dirty || saving}
                  >
                    {saving ? "Saving…" : "Save preferences"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </div>
          <SettingsSidebar
            tab={tab}
            preferences={draft || preferences}
            sessions={sessions}
            loading={loading}
            dirty={dirty}
            onAction={shortcut}
          />
        </div>
      </Tabs>
      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          if (!passwordBusy) setPasswordOpen(open)
        }}
      >
        <DialogContent
          showCloseButton={!passwordBusy}
          onEscapeKeyDown={(event) => {
            if (passwordBusy) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (passwordBusy) event.preventDefault()
          }}
          className="max-h-[calc(100dvh-32px)] w-[min(640px,calc(100vw-32px))] max-w-[640px] overflow-y-auto rounded-xl p-0"
        >
          <DialogTitle className="sr-only">Change password</DialogTitle>
          <DialogDescription className="sr-only">
            Enter your current password and choose a new password.
          </DialogDescription>
          <div className="[&>section]:rounded-none [&>section]:border-0">
            <SecurityDetails onBusyChange={setPasswordBusy} />
          </div>
        </DialogContent>
      </Dialog>
      {target && (
        <ConfirmationDialog
          title={
            target === "others"
              ? "Sign out other sessions?"
              : "Sign out this session?"
          }
          subject={
            target === "others"
              ? "All devices except this browser"
              : target.device
          }
          description="The affected devices will need to sign in again to access your account."
          confirmLabel="Sign out"
          pendingLabel="Signing out…"
          pending={pending}
          error={sessionError}
          onClose={() => setTarget(null)}
          onConfirm={() => void endSession()}
        />
      )}
    </main>
  )
}
