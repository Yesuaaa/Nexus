"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useAuthTransition } from "../providers/auth-provider"
import {
  ApiError,
  clearSocialFlow,
  completeSocialAuth,
  getSocialFlow,
  saveSocialFlow,
  sendSocialEmailCode,
  startSocialAuth,
  type SocialFlow,
} from "../api/auth-api"
import { getAuthCopy, getStoredAuthLanguage } from "../content/auth-copy"

type Onboarding = {
  code: string
  flow: SocialFlow
  fullName: string
  contactNumber: string
  email: string
  emailRequired: boolean
}

const mainClass =
  "grid min-h-dvh place-items-center bg-[#f5f8fc] px-5 py-10 text-[#172735]"
const fieldClass =
  "mt-1 h-11 w-full rounded-md border border-[#cbd6e4] bg-white px-3 text-sm outline-none focus:border-[#317bb0] focus:ring-2 focus:ring-[#317bb0]/20"

export function SocialCompletePage() {
  const router = useRouter()
  const { beginLoginTransition } = useAuthTransition()
  const copy = getAuthCopy(getStoredAuthLanguage())
  const started = useRef(false)
  const [status, setStatus] = useState<
    "loading" | "onboarding" | "reauthenticated" | "error"
  >("loading")
  const [message, setMessage] = useState<string>(copy.socialCompleting)
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null)
  const [emailCode, setEmailCode] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void Promise.resolve().then(async () => {
      const params = new URLSearchParams(window.location.hash.slice(1))
      const code = params.get("code")
      const providerError = params.get("error")
      const flow = getSocialFlow()

      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      )

      if (providerError) {
        clearSocialFlow()
        setStatus("error")
        setMessage(
          providerError === "cancelled"
            ? copy.socialCancelled
            : copy.socialFailed,
        )
        return
      }
      const completionCode = code ?? flow?.code
      if (!completionCode || !flow) {
        clearSocialFlow()
        setStatus("error")
        setMessage(copy.socialMissingFlow)
        return
      }
      const verifiedCode = completionCode

      try {
        if (code) saveSocialFlow({ ...flow, code })
        const result = await completeSocialAuth({
          code: verifiedCode,
          verifier: flow.verifier,
        })
        if ("onboarding" in result) {
          setOnboarding({
            code: verifiedCode,
            flow: { ...flow, code: verifiedCode },
            fullName: result.fullName ?? "",
            contactNumber: "",
            email: result.email ?? "",
            emailRequired: result.emailRequired,
          })
          setMessage("")
          setStatus("onboarding")
          return
        }
        if ("reauthenticated" in result) {
          if (flow.purpose === "reauth" && flow.nextProvider) {
            const { url } = await startSocialAuth(flow.nextProvider, {
              purpose: "link",
            })
            window.location.assign(url)
            return
          }
          clearSocialFlow()
          setStatus("reauthenticated")
          setMessage(
            "Identity confirmed. You can now connect another sign-in method in Settings.",
          )
          return
        }
        clearSocialFlow()
        if ("linked" in result) {
          router.replace("/settings/connections?linked=1")
          return
        }
        beginLoginTransition("login")
      } catch (error: unknown) {
        clearSocialFlow()
        setStatus("error")
        setMessage(
          error instanceof ApiError && error.status === 409
            ? copy.socialExistingAccount
            : copy.socialFailed,
        )
      }
    })
  }, [beginLoginTransition, copy, router])

  async function handleSendEmailCode() {
    if (!onboarding || pending || !onboarding.email.trim()) return
    setPending(true)
    setMessage("")
    try {
      await sendSocialEmailCode(
        onboarding.code,
        onboarding.flow.verifier,
        onboarding.email.trim(),
      )
      setEmailSent(true)
      setMessage("")
    } catch {
      setMessage(copy.socialEmailCodeSentError)
    } finally {
      setPending(false)
    }
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onboarding || pending) return
    setPending(true)
    setMessage("")
    try {
      const result = await completeSocialAuth({
        code: onboarding.code,
        verifier: onboarding.flow.verifier,
        fullName: onboarding.fullName.trim(),
        contactNumber: onboarding.contactNumber.trim(),
        ...(onboarding.emailRequired
          ? { email: onboarding.email.trim(), emailCode: emailCode.trim() }
          : {}),
      })
      if ("token" in result) {
        clearSocialFlow()
        beginLoginTransition("register")
      } else if ("linked" in result) {
        clearSocialFlow()
        router.replace("/settings/connections?linked=1")
      } else if ("onboarding" in result) {
        setMessage(copy.socialCompleteError)
      }
    } catch (error) {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? copy.socialExistingAccount
          : copy.socialCompleteError,
      )
    } finally {
      setPending(false)
    }
  }

  if (status === "onboarding" && onboarding) {
    return (
      <main className={mainClass}>
        <section className="w-full max-w-[440px] rounded-xl border border-[#e0e7f0] bg-white p-7 shadow-[0_12px_36px_rgb(22_44_72_/_8%)]">
          <h1 className="text-xl font-semibold">{copy.socialCompleteTitle}</h1>
          <p className="mt-2 text-sm text-[#5b709e]">{copy.registerSubtitle}</p>
          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => void handleComplete(event)}
          >
            <label
              className="block text-sm font-medium"
              htmlFor="social-full-name"
            >
              {copy.socialFullName}
              <input
                className={fieldClass}
                id="social-full-name"
                name="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={onboarding.fullName}
                onChange={(event) =>
                  setOnboarding({ ...onboarding, fullName: event.target.value })
                }
              />
            </label>
            <label
              className="block text-sm font-medium"
              htmlFor="social-contact-number"
            >
              {copy.contactNumber}
              <input
                className={fieldClass}
                id="social-contact-number"
                name="contactNumber"
                type="tel"
                autoComplete="tel"
                required
                pattern="\\+?[0-9][0-9\\s-]{6,19}"
                title={copy.contactInvalid}
                placeholder="+63"
                value={onboarding.contactNumber}
                onChange={(event) =>
                  setOnboarding({
                    ...onboarding,
                    contactNumber: event.target.value,
                  })
                }
              />
            </label>
            {onboarding.emailRequired && (
              <>
                <label
                  className="block text-sm font-medium"
                  htmlFor="social-email"
                >
                  {copy.emailAddress}
                  <input
                    className={fieldClass}
                    id="social-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={onboarding.email}
                    onChange={(event) => {
                      setEmailSent(false)
                      setOnboarding({
                        ...onboarding,
                        email: event.target.value,
                      })
                    }}
                  />
                </label>
                <div>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="social-email-code"
                  >
                    {copy.socialEmailCode}
                    <input
                      className={fieldClass}
                      id="social-email-code"
                      name="emailCode"
                      autoComplete="one-time-code"
                      required
                      value={emailCode}
                      onChange={(event) => setEmailCode(event.target.value)}
                    />
                  </label>
                  <button
                    className="mt-2 text-sm font-semibold text-[#253f8c] underline underline-offset-2 disabled:opacity-60"
                    type="button"
                    disabled={pending || !onboarding.email.trim()}
                    onClick={() => void handleSendEmailCode()}
                  >
                    {pending ? copy.socialCompleting : copy.socialSendCode}
                  </button>
                </div>
                {emailSent && (
                  <p className="text-sm text-[#246640]" role="status">
                    {copy.socialCodeSent}
                  </p>
                )}
              </>
            )}
            {message && (
              <p className="text-sm text-[#a1293d]" role="alert">
                {message}
              </p>
            )}
            <button
              className="h-11 rounded-md bg-[#253f8c] text-sm font-semibold text-white hover:bg-[#1a3276] disabled:cursor-wait disabled:opacity-60"
              type="submit"
              disabled={pending || (onboarding.emailRequired && !emailSent)}
            >
              {pending ? copy.socialCompleting : copy.socialContinue}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className={mainClass}>
      <section
        className="w-full max-w-[440px] rounded-xl border border-[#e0e7f0] bg-white p-7 text-center shadow-[0_12px_36px_rgb(22_44_72_/_8%)]"
        aria-live="polite"
      >
        {status === "loading" && (
          <p role="status">{message || copy.socialCompleting}</p>
        )}
        {status === "error" && (
          <>
            <h1 className="text-lg font-semibold">{copy.signInFailed}</h1>
            <p className="mt-2 text-sm text-[#a1293d]" role="alert">
              {message}
            </p>
            <a
              className="mt-5 inline-block font-semibold text-[#253f8c] underline underline-offset-2"
              href="/login"
            >
              {copy.signInButton}
            </a>
          </>
        )}
        {status === "reauthenticated" && (
          <>
            <h1 className="text-lg font-semibold">Identity confirmed</h1>
            <p className="mt-2 text-sm text-[#5b709e]">{message}</p>
            <a
              className="mt-5 inline-block font-semibold text-[#253f8c] underline underline-offset-2"
              href="/settings/connections"
            >
              Open Settings
            </a>
          </>
        )}
      </section>
    </main>
  )
}
