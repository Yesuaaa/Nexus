"use client"

import { useEffect, useState } from "react"
import {
  ApiError,
  getSocialConnections,
  getSocialProviders,
  startSocialAuth,
  type SocialProvider,
} from "../api/auth-api"

const labels: Record<SocialProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
}

export function ConnectionsPage() {
  const [providers, setProviders] = useState<
    Partial<Record<SocialProvider, boolean>>
  >({})
  const [connections, setConnections] = useState<{
    providers: string[]
    hasPassword: boolean
  } | null>(null)
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.all([getSocialProviders(), getSocialConnections()])
      .then(([available, linked]) => {
        if (!active) return
        setProviders(available)
        setConnections(linked)
        setLoadError(null)
        if (new URLSearchParams(window.location.search).has("linked")) {
          setNotice("Sign-in method connected.")
          window.history.replaceState(null, "", window.location.pathname)
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Couldn't load your sign-in methods. Refresh the page to try again.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  async function beginLink(target: SocialProvider, currentPassword?: string) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const { url } = await startSocialAuth(target, {
        purpose: "link",
        ...(currentPassword ? { currentPassword } : {}),
      })
      window.location.assign(url)
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? "That password wasn't accepted. Check it and try again."
          : "Couldn't start linking this sign-in method. Please try again.",
      )
      setPending(false)
    }
  }

  async function beginReauth(target: SocialProvider, current: SocialProvider) {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const { url } = await startSocialAuth(current, {
        purpose: "reauth",
        nextProvider: target,
      })
      window.location.assign(url)
    } catch {
      setError(
        "Couldn't verify your existing sign-in method. Please try again.",
      )
      setPending(false)
    }
  }

  const availableProviders = (Object.keys(labels) as SocialProvider[]).filter(
    (provider) => providers[provider],
  )
  const linkedProviders = new Set(connections?.providers ?? [])

  return (
    <main className="mx-auto w-full max-w-[880px] px-5 py-8 md:px-8">
      <div>
        <p className="text-sm font-semibold text-[#52688d]">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#172735]">
          Sign-in methods
        </h1>
        <p className="mt-2 max-w-[620px] text-sm leading-6 text-[#5b709e]">
          Connect a provider so you can use it to sign in to your EXP account.
        </p>
      </div>

      {notice && (
        <p
          className="mt-6 rounded-md bg-[#eaf6ee] px-4 py-3 text-sm text-[#246640]"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p
          className="mt-6 rounded-md bg-[#fff0f0] px-4 py-3 text-sm text-[#a1293d]"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p className="mt-8 text-sm text-[#5b709e]" role="status">
          Loading your sign-in methods…
        </p>
      ) : loadError || !connections ? (
        <div className="mt-8">
          <p className="text-sm text-[#a1293d]" role="alert">
            {loadError ?? "Couldn't load your sign-in methods. Try again."}
          </p>
          <button
            className="mt-3 text-sm font-semibold text-[#253f8c] underline underline-offset-2"
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadAttempt((current) => current + 1)
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <section
          className="mt-7 overflow-hidden rounded-xl border border-[#e0e5eb] bg-white"
          aria-label="Available sign-in providers"
        >
          {availableProviders.length === 0 && (
            <p className="px-5 py-6 text-sm text-[#5b709e]">
              No social sign-in providers are available right now.
            </p>
          )}
          {availableProviders.map((provider) => {
            const connected = linkedProviders.has(provider)
            return (
              <article
                key={provider}
                className="flex flex-col gap-4 border-b border-[#e8edf3] px-5 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h2 className="font-semibold text-[#172735]">
                    {labels[provider]}
                  </h2>
                  <p className="mt-1 text-sm text-[#5b709e]">
                    {connected
                      ? "Connected to your EXP account"
                      : "Not connected"}
                  </p>
                </div>
                {connected ? (
                  <span className="text-sm font-medium text-[#246640]">
                    Connected
                  </span>
                ) : connections.hasPassword ? (
                  <div className="flex w-full flex-col gap-2 sm:w-[300px]">
                    <label
                      className="text-xs font-medium text-[#52688d]"
                      htmlFor={`password-${provider}`}
                    >
                      Confirm your password
                    </label>
                    <input
                      id={`password-${provider}`}
                      className="h-10 rounded-md border border-[#cbd6e4] px-3 text-sm outline-none focus:border-[#317bb0] focus:ring-2 focus:ring-[#317bb0]/20"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      className="h-10 rounded-md bg-[#253f8c] px-4 text-sm font-semibold text-white hover:bg-[#1a3276] disabled:cursor-wait disabled:opacity-60"
                      type="button"
                      disabled={pending || !password}
                      onClick={() => void beginLink(provider, password)}
                    >
                      Connect {labels[provider]}
                    </button>
                  </div>
                ) : connections.providers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {connections.providers.map((currentName) => {
                      if (!(currentName in labels)) return null
                      const current = currentName as SocialProvider
                      return (
                        <button
                          key={current}
                          className="min-h-10 rounded-md border border-[#cbd6e4] px-3 text-sm font-medium text-[#253f8c] hover:bg-[#f4f7fb] disabled:opacity-60"
                          type="button"
                          disabled={pending}
                          onClick={() => void beginReauth(provider, current)}
                        >
                          Verify with {labels[current]}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-[#5b709e]">
                    Add a sign-in method before connecting another provider.
                  </p>
                )}
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}
