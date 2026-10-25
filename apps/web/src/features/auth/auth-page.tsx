import { useState } from "react"
import { AuthLayout } from "./components/auth-layout"
import { AuthContent } from "./components/form"
import { AuthHeader } from "./components/header"
import { PhotoPanel } from "./components/visuals"
import { getAuthCopy, getStoredAuthLanguage, storeAuthLanguage } from "./copy"
import type { AuthLanguage, AuthMode } from "./types"

export function AuthPage({
  mode,
  onLoggedIn,
}: {
  mode: AuthMode
  onLoggedIn: (mode: AuthMode) => void
}) {
  const [language, setLanguage] = useState<AuthLanguage>(getStoredAuthLanguage)
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
          compact
        />
      }
      footer={
        <footer className="flex min-h-14 items-center justify-center gap-4 px-5 py-3 text-xs text-[#52688d] whitespace-nowrap max-[420px]:flex-wrap max-[420px]:gap-x-3 max-[420px]:gap-y-[5px] max-[420px]:leading-[1.4] [@media(min-width:851px)_and_(max-height:1100px)]:min-h-10 [@media(min-width:851px)_and_(max-height:1100px)]:py-2">
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
