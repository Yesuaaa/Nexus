import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import type { AuthCopy } from "../content/auth-copy"
import {
  focusOutline,
  heroTitleClass,
  socialIconClass,
} from "../styles/auth-styles"
import type { AuthLanguage, AuthMode } from "../model/types"
import {
  getSocialProviders,
  startSocialAuth,
  type SocialProvider,
} from "../api/auth-api"

const photos = [
  "/auth/community-1.png",
  "/auth/community-2.png",
  "/auth/community-3.png",
]

export function PhotoPanel({
  mode,
  copy,
  language,
}: {
  mode: AuthMode
  copy: AuthCopy
  language: AuthLanguage
}) {
  const [active, setActive] = useState(0)
  const reduceMotion = useReducedMotion()
  const responsiveHeroTitleClass =
    language === "fil"
      ? "max-[1100px]:text-[clamp(32px,3.6vw,46px)]"
      : "max-[1100px]:text-[clamp(39px,4.3vw,56px)]"

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % photos.length),
      6000,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside
      className="relative h-svh min-h-0 overflow-hidden rounded-r-[26px] bg-[#173456] max-[850px]:hidden"
      aria-label={copy.community}
    >
      {photos.map((src, index) => (
        <img
          key={src}
          className={`absolute inset-0 size-full object-cover object-center transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${index === active ? "opacity-100" : "opacity-0"}`}
          src={src}
          alt=""
          aria-hidden="true"
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(10_30_52_/_77%)_0%,rgb(13_39_67_/_49%)_60%,rgb(12_45_77_/_38%)_100%),linear-gradient(0deg,rgb(5_31_56_/_48%),transparent_55%)]" />
      <motion.div
        key={mode}
        className="absolute z-1 top-[37%] left-[clamp(42px,6.2%,90px)] w-[min(83%,650px)] text-white"
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        {mode === "login" ? (
          <>
            <h1 className={`${heroTitleClass} ${responsiveHeroTitleClass}`}>
              {copy.loginHeroLine1}
              <br />
              <span className="bg-linear-to-r from-[#0989e5] to-[#23cae0] bg-clip-text text-transparent">
                {copy.loginHeroLine2}
              </span>
              <br />
              {copy.loginHeroLine3}
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[clamp(16px,1.04vw,20px)] leading-[1.32]">
              {copy.loginHeroDescription}
            </p>
          </>
        ) : (
          <>
            <h1 className={`${heroTitleClass} ${responsiveHeroTitleClass}`}>
              {copy.registerHeroLine1}
              <br />
              <span className="bg-linear-to-r from-[#0989e5] to-[#23cae0] bg-clip-text text-transparent">
                {copy.registerHeroLine2}
              </span>
              <br />
              {copy.registerHeroLine3}
            </h1>
            <p className="mt-[22px] max-w-[560px] text-[clamp(16px,1.04vw,20px)] leading-[1.32]">
              {copy.registerHeroDescription}
            </p>
          </>
        )}
      </motion.div>
      <div
        className="absolute right-8 bottom-5 z-2 flex items-center gap-2"
        aria-label={copy.choosePhoto}
      >
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            className={`size-[7px] cursor-pointer rounded-full border-0 p-0 ${index === active ? "bg-[#2ed9e7] opacity-100" : "bg-white opacity-90"} ${focusOutline}`}
            onClick={() => setActive(index)}
            aria-label={`${copy.showPhoto} ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
          />
        ))}
      </div>
    </aside>
  )
}

const socialProviders: SocialProvider[] = ["google", "facebook", "apple"]

function SocialMark({ provider }: { provider: SocialProvider }) {
  if (provider === "google") {
    return (
      <svg className="size-6" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.35 12.21c0-.71-.06-1.42-.19-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.95 2.94v2.54h3.16c1.85-1.71 2.9-4.23 2.9-7.36Z"
        />
        <path
          fill="#34A853"
          d="M12 21.5c2.64 0 4.86-.87 6.48-2.36l-3.16-2.54c-.88.59-2 .94-3.32.94-2.55 0-4.71-1.72-5.48-4.03H3.25v2.62A9.5 9.5 0 0 0 12 21.5Z"
        />
        <path
          fill="#FBBC05"
          d="M6.52 13.51a5.7 5.7 0 0 1 0-3.02V7.87H3.25a9.5 9.5 0 0 0 0 8.26l3.27-2.62Z"
        />
        <path
          fill="#EA4335"
          d="M12 6.46c1.44 0 2.73.5 3.75 1.47l2.81-2.81A9.13 9.13 0 0 0 12 2.5a9.5 9.5 0 0 0-8.75 5.37l3.27 2.62C7.29 8.18 9.45 6.46 12 6.46Z"
        />
      </svg>
    )
  }
  if (provider === "facebook") {
    return (
      <span
        className="text-[25px] leading-none font-bold text-[#3264d8]"
        aria-hidden="true"
      >
        f
      </span>
    )
  }
  return (
    <svg
      className="size-[21px]"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.7 12.9c0-2 1.6-2.9 1.7-3-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8s-1.6-.8-2.6-.8c-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.7-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.2-.1 0-1.9-.7-1.9-2.5ZM15.4 6.8c.6-.7 1-1.6.9-2.6-.9 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.5 1 .1 1.9-.5 2.5-1.2Z" />
    </svg>
  )
}

export function SocialSignInButtons({ copy }: { copy: AuthCopy }) {
  const [providers, setProviders] = useState<
    Partial<Record<SocialProvider, boolean>>
  >({})
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    void getSocialProviders()
      .then((available) => {
        if (active) {
          setProviders(available)
          setError(null)
        }
      })
      .catch(() => {
        if (active) setError(copy.socialOptionsUnavailable)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [copy.socialOptionsUnavailable, refresh])

  async function begin(provider: SocialProvider) {
    if (pending) return
    setError(null)
    setPending(provider)
    try {
      const { url } = await startSocialAuth(provider)
      window.location.assign(url)
    } catch {
      setError(copy.socialStartFailed)
      setPending(null)
    }
  }

  return (
    <div>
      <div className="flex justify-center gap-4" aria-label={copy.continueWith}>
        {loading && (
          <p className="text-xs text-[#7485a7]" role="status">
            Loading sign-in options…
          </p>
        )}
        {!loading &&
          socialProviders.map(
            (provider) =>
              providers[provider] && (
                <button
                  key={provider}
                  type="button"
                  className={`${socialIconClass} ${provider === "facebook" ? "text-[#3264d8]" : "text-[#111]"} disabled:cursor-wait disabled:opacity-60 ${focusOutline}`}
                  aria-label={
                    provider === "google"
                      ? copy.continueWithGoogle
                      : provider === "facebook"
                        ? copy.continueWithFacebook
                        : copy.continueWithApple
                  }
                  title={
                    provider === "google"
                      ? copy.continueWithGoogle
                      : provider === "facebook"
                        ? copy.continueWithFacebook
                        : copy.continueWithApple
                  }
                  disabled={pending !== null}
                  onClick={() => void begin(provider)}
                >
                  {pending === provider ? (
                    <span className="text-xs" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <SocialMark provider={provider} />
                  )}
                </button>
              ),
          )}
        {!loading &&
          !error &&
          !socialProviders.some((provider) => providers[provider]) && (
            <p className="text-xs text-[#7485a7]" role="status">
              {copy.socialUnavailable}
            </p>
          )}
      </div>
      {error && (
        <div className="mt-2 text-center">
          <p className="text-xs text-[#a1293d]" role="alert">
            {error}
          </p>
          {loading === false && providers.google === undefined && (
            <button
              type="button"
              className={`mt-1 text-xs font-semibold text-[#253f8c] underline underline-offset-2 ${focusOutline}`}
              onClick={() => {
                setLoading(true)
                setRefresh((current) => current + 1)
              }}
            >
              {copy.socialRetry}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
