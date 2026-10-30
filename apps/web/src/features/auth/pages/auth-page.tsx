"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
} from "../api/auth-api"
import { useAuthTransition } from "../providers/auth-provider"
import { AuthLayout } from "../components/auth-layout"
import { AuthContent } from "../components/auth-form"
import { AuthHeader } from "../components/auth-header"
import { PhotoPanel } from "../components/auth-visuals"
import {
  getAuthCopy,
  getStoredAuthLanguage,
  storeAuthLanguage,
} from "../content/auth-copy"
import type { AuthLanguage, AuthMode } from "../model/types"

function subscribeLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

function getServerLanguage(): AuthLanguage {
  return "en"
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [guest, setGuest] = useState(false)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(async () => {
        if (!active) return false
        if (!getToken()) {
          setGuest(true)
          return false
        }
        return await getCurrentAccount()
      })
      .then((session) => {
        if (active && session) router.replace("/dashboard")
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 401) {
          clearToken()
          setGuest(true)
        } else {
          setError(true)
        }
      })
    return () => {
      active = false
    }
  }, [router, revision])

  if (guest) return <AuthFormPage mode={mode} />
  return (
    <main className="grid min-h-dvh place-content-center gap-4 bg-[var(--portal-canvas)] px-6 text-center text-sm text-[#5a6f95]">
      <h1 className="m-0 text-xl font-semibold text-[#203f8c]">
        {mode === "login" ? "Welcome Back" : "Create Account"}
      </h1>
      {error ? (
        <>
          <p role="alert" className="m-0">
            We couldn't check your session. Please try again.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setError(false)
              setRevision((value) => value + 1)
            }}
          >
            Try again
          </Button>
        </>
      ) : (
        <p role="status">Checking your session…</p>
      )}
    </main>
  )
}

function AuthFormPage({ mode }: { mode: AuthMode }) {
  const { beginLoginTransition: onLoggedIn } = useAuthTransition()
  const storedLanguage = useSyncExternalStore(
    subscribeLanguage,
    getStoredAuthLanguage,
    getServerLanguage,
  )
  const [selectedLanguage, setLanguage] = useState<AuthLanguage | null>(null)
  const language = selectedLanguage ?? storedLanguage
  const copy = getAuthCopy(language)

  function changeLanguage(next: AuthLanguage) {
    setLanguage(next)
    storeAuthLanguage(next)
  }

  return (
    <AuthLayout
      language={language}
      visual={<PhotoPanel mode={mode} copy={copy} language={language} />}
      header={
        <AuthHeader
          copy={copy}
          language={language}
          onLanguageChange={changeLanguage}
        />
      }
      footer={
        <footer className="flex min-h-14 items-center justify-center gap-4 px-5 py-3 text-xs text-[#52688d] whitespace-nowrap max-[420px]:flex-wrap max-[420px]:gap-x-3 max-[420px]:gap-y-[5px] max-[420px]:leading-[1.4]">
          <span>{copy.about}</span>
          <span>{copy.terms}</span>
          <span>{copy.privacy}</span>
          <span>{copy.cookies}</span>
          <span>{copy.copyright}</span>
        </footer>
      }
    >
      <AuthContent
        key={mode}
        mode={mode}
        copy={copy}
        language={language}
        onLoggedIn={onLoggedIn}
      />
    </AuthLayout>
  )
}
