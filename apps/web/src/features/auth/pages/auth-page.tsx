"use client"

import { useState, useSyncExternalStore } from "react"
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
