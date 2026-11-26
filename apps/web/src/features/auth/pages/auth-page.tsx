"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { sileo } from "@/lib/toast"
import {
  ApiError,
  clearToken,
  getCurrentAccount,
  getToken,
} from "../api/auth-api"
import { AuthLayout } from "../components/auth-layout"
import { AuthContent } from "../components/auth-form"
import { AuthHeader } from "../components/auth-header"
import { PhotoPanel } from "../components/auth-visuals"
import {
  getAuthCopy,
  getStoredAuthLanguage,
  storeAuthLanguage,
} from "../content/auth-copy"
import type { AuthLanguage, AuthMode, AuthPortal } from "../model/types"
import { landingPathForRole } from "../model/auth-portal"
import type { Role } from "../model/roles"
import { withInquiryService } from "@/features/public-services/model/service-inquiry-link"

function authDestination(role: Role, inquiryService?: string) {
  return role === "USER" && inquiryService
    ? withInquiryService("/services", inquiryService)
    : landingPathForRole(role)
}

function subscribeLanguage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

function getServerLanguage(): AuthLanguage {
  return "en"
}

function hasStoredSession() {
  return Boolean(getToken())
}

function getServerSession() {
  return false
}

export function AuthPage({
  mode,
  portal = "client",
  inquiryService,
}: {
  mode: AuthMode
  portal?: AuthPortal
  inquiryService?: string
}) {
  const router = useRouter()
  const hasSession = useSyncExternalStore(
    subscribeLanguage,
    hasStoredSession,
    getServerSession,
  )
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
        if (active && session)
          router.replace(authDestination(session.user.role, inquiryService))
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
  }, [router, revision, inquiryService])

  // Public content is useful before hydration. Existing sessions still go
  // through the server account check before entering the protected portal.
  if (guest || !hasSession)
    return (
      <AuthFormPage
        mode={mode}
        portal={portal}
        inquiryService={inquiryService}
      />
    )
  return (
    <main className="grid min-h-dvh place-content-center gap-4 bg-[var(--portal-canvas)] px-6 text-center text-sm text-[#5a6f95]">
      <h1 className="m-0 text-xl font-semibold text-[#203f8c]">
        {mode === "register"
          ? "Create Account"
          : portal === "workforce"
            ? "Team Portal"
            : "Welcome Back"}
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

function AuthFormPage({
  mode,
  portal,
  inquiryService,
}: {
  mode: AuthMode
  portal: AuthPortal
  inquiryService?: string
}) {
  const router = useRouter()
  const storedLanguage = useSyncExternalStore(
    subscribeLanguage,
    getStoredAuthLanguage,
    getServerLanguage,
  )
  const [selectedLanguage, setLanguage] = useState<AuthLanguage | null>(null)
  const language = selectedLanguage ?? storedLanguage
  const copy = getAuthCopy(language)

  function onLoggedIn(nextMode: AuthMode, role: Role) {
    router.replace(authDestination(role, inquiryService))
    sileo.success({
      title:
        nextMode === "register" ? copy.accountCreated : copy.welcomeBackToast,
      description:
        nextMode === "register" ? copy.welcomeToExp : copy.signedInToast,
      position: "top-center",
    })
  }

  function changeLanguage(next: AuthLanguage) {
    setLanguage(next)
    storeAuthLanguage(next)
  }

  return (
    <AuthLayout
      centered={portal === "workforce"}
      clientSplit={portal === "client"}
      language={language}
      visual={
        portal === "client" && (
          <PhotoPanel
            mode={mode}
            portal={portal}
            copy={copy}
            language={language}
          />
        )
      }
      header={
        <AuthHeader
          copy={copy}
          language={language}
          onLanguageChange={changeLanguage}
          workforce={portal === "workforce"}
        />
      }
      footer={
        <footer
          className={
            portal === "workforce"
              ? "px-6 pb-5 text-left text-xs text-[#8a9dbb] sm:px-8"
              : "flex min-h-14 items-center justify-center gap-4 px-5 py-3 text-xs text-[#52688d] whitespace-nowrap max-[420px]:flex-wrap max-[420px]:gap-x-3 max-[420px]:gap-y-[5px] max-[420px]:leading-[1.4]"
          }
        >
          {portal === "workforce" ? (
            "© 2026 Converyn Inc. All rights reserved."
          ) : (
            <>
              <Link href="/">{copy.about}</Link>
              <span>{copy.copyright}</span>
            </>
          )}
        </footer>
      }
    >
      <AuthContent
        key={`${portal}-${mode}`}
        mode={mode}
        portal={portal}
        copy={copy}
        inquiryService={inquiryService}
        onLoggedIn={onLoggedIn}
      />
    </AuthLayout>
  )
}
