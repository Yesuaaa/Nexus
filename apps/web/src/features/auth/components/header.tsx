import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Link } from "react-router"
import { MotionConfig, motion } from "framer-motion"
import type { AuthCopy } from "../copy"
import {
  focusOutline,
  idleNavClass,
  navLinkClass,
  selectedNavClass,
} from "./styles"
import type { AuthLanguage, AuthMode } from "../types"

function LanguagePicker({
  language,
  copy,
  onChange,
}: {
  language: AuthLanguage
  copy: AuthCopy
  onChange: (language: AuthLanguage) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const englishRef = useRef<HTMLButtonElement>(null)
  const filipinoRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const selected = language === "en" ? englishRef : filipinoRef
    selected.current?.focus()
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", closeOnOutsideClick)
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick)
  }, [open, language])

  function choose(next: AuthLanguage) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      triggerRef.current?.focus()
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const current =
        document.activeElement === englishRef.current ? "en" : "fil"
      const next = current === "en" ? filipinoRef : englishRef
      next.current?.focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      englishRef.current?.focus()
    } else if (event.key === "End") {
      event.preventDefault()
      filipinoRef.current?.focus()
    }
  }

  return (
    <div
      className="relative z-5 text-[#26395e] max-[420px]:text-xs"
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        className={`group inline-flex min-h-11 items-center gap-2 border-0 bg-transparent px-2 font-[inherit] text-inherit cursor-pointer ${focusOutline}`}
        type="button"
        aria-label={`${copy.language}: ${language === "en" ? "English" : "Filipino"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span>{language === "en" ? "English" : "Filipino"}</span>
        <svg
          className="size-3.5 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] transition-transform duration-150 group-aria-expanded:rotate-180"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="m3 6 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 w-max min-w-full rounded-lg border border-[#d7dfed] bg-white p-1 text-inherit shadow-[0_12px_32px_rgb(20_45_97_/_13%)]"
          role="menu"
          aria-label={copy.language}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
          }}
        >
          <button
            ref={englishRef}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border-0 bg-transparent px-1 text-left font-[inherit] text-inherit cursor-pointer focus-visible:bg-[#eef1f8] ${focusOutline}`}
            type="button"
            role="menuitemradio"
            aria-checked={language === "en"}
            onClick={() => choose("en")}
          >
            English
            {language === "en" && <span aria-hidden="true">✓</span>}
          </button>
          <button
            ref={filipinoRef}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md border-0 bg-transparent px-1 text-left font-[inherit] text-inherit cursor-pointer focus-visible:bg-[#eef1f8] ${focusOutline}`}
            type="button"
            role="menuitemradio"
            aria-checked={language === "fil"}
            onClick={() => choose("fil")}
          >
            Filipino
            {language === "fil" && <span aria-hidden="true">✓</span>}
          </button>
        </div>
      )}
    </div>
  )
}

function AuthTab({
  mode,
  currentMode,
  label,
}: {
  mode: AuthMode
  currentMode: AuthMode
  label: string
}) {
  const active = mode === currentMode

  return (
    <Link
      to={mode === "login" ? "/login" : "/register"}
      className={`${navLinkClass} ${active ? selectedNavClass : idleNavClass}`}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <motion.span
          layoutId="auth-active-tab"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
          className="absolute inset-0 rounded-full bg-[#253f8c] transition-colors group-hover:bg-[#1a3276]"
          aria-hidden="true"
        />
      )}
      <span className="relative z-1">{label}</span>
    </Link>
  )
}

export function AuthHeader({
  mode,
  copy,
  language,
  onLanguageChange,
}: {
  mode: AuthMode
  copy: AuthCopy
  language: AuthLanguage
  onLanguageChange: (language: AuthLanguage) => void
}) {
  return (
    <header className="flex h-[73px] items-center justify-center gap-2 px-6 text-[13px] max-[420px]:justify-end max-[420px]:px-[17px]">
      <LanguagePicker
        language={language}
        copy={copy}
        onChange={onLanguageChange}
      />
      <MotionConfig reducedMotion="user">
        <nav
          className="inline-flex items-center rounded-full border border-[#dce1eb] bg-[#eef1f8] p-0.5"
          aria-label={copy.accountNavigation}
        >
          <AuthTab mode="login" currentMode={mode} label={copy.signInLink} />
          <AuthTab
            mode="register"
            currentMode={mode}
            label={copy.createAccountLink}
          />
        </nav>
      </MotionConfig>
    </header>
  )
}
