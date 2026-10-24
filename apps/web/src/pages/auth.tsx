import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react"
import { Link, useNavigate } from "react-router"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, register, signIn } from "@/lib/auth"
import {
  getAuthCopy,
  getStoredAuthLanguage,
  storeAuthLanguage,
  type AuthCopy,
  type AuthLanguage,
} from "./auth-copy"

const focusOutline =
  "focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#27c5db]"
const fieldClass = "grid min-w-0 gap-[9px]"
const labelClass = "text-[13px] font-bold uppercase text-[#121a2b]"
const inputClass =
  "h-[47px] w-full rounded-xl border border-[#cdd8e8] bg-white px-4 py-0 text-sm text-[#182a4c] shadow-none outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#788aad] placeholder:opacity-100 focus:border-[#54b9d8] focus:shadow-[0_0_0_3px_rgb(48_187_216_/_14%)] focus-visible:ring-0 aria-[invalid=true]:border-[#cf5265] aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(207_82_101_/_15%)]"
const navLinkClass =
  "inline-flex h-9 min-w-[82px] items-center justify-center rounded-full border-2 text-sm font-semibold no-underline transition-[color,border-color] duration-150 hover:text-[#213f8c] max-[420px]:min-w-[73px] max-[420px]:text-[13px] motion-reduce:transition-none " +
  focusOutline
const selectedNavClass = "border-[#dce1eb] text-[#203e88]"
const idleNavClass = "border-transparent text-[#526893]"
const heroTitleClass =
  "text-[clamp(42px,3.55vw,68px)] leading-[0.98] font-[750] tracking-[-0.045em]"
const socialIconClass =
  "grid size-12 select-none place-items-center rounded-[11px] border-2 border-[#dfe4ef] bg-white text-2xl font-bold leading-none"

type Mode = "login" | "register"
type Field =
  "fullName" | "contactNumber" | "email" | "password" | "confirmPassword"
type FieldErrors = Partial<Record<Field, string>>

const fieldIds: Record<Field, string> = {
  fullName: "full-name",
  contactNumber: "contact-number",
  email: "email",
  password: "password",
  confirmPassword: "confirm-password",
}

function validateAuth(
  mode: Mode,
  values: Record<Field, string>,
  copy: AuthCopy,
): FieldErrors {
  const errors: FieldErrors = {}
  const email = values.email.trim()

  if (mode === "register") {
    const name = values.fullName.trim()
    const contact = values.contactNumber.trim()
    if (!name) errors.fullName = copy.nameRequired
    else if (name.length < 2 || name.length > 100)
      errors.fullName = copy.nameLength

    if (!contact) errors.contactNumber = copy.contactRequired
    else if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(contact))
      errors.contactNumber = copy.contactInvalid
  }

  if (!email) errors.email = copy.emailRequired
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = copy.emailInvalid

  if (!values.password) errors.password = copy.passwordRequired
  else if (mode === "register" && values.password.length < 12)
    errors.password = copy.passwordShort
  else if (new TextEncoder().encode(values.password).length > 1024)
    errors.password = copy.passwordLong

  if (mode === "register") {
    if (!values.confirmPassword) errors.confirmPassword = copy.confirmRequired
    else if (values.confirmPassword !== values.password)
      errors.confirmPassword = copy.passwordMismatch
  }

  return errors
}

function requestErrorMessage(
  error: unknown,
  mode: Mode,
  copy: AuthCopy,
): string {
  if (error instanceof ApiError) {
    if (mode === "login" && error.status === 401) return copy.badCredentials
    if (mode === "register" && error.status === 409) return copy.emailRegistered
    if (error.status === 429) return copy.rateLimited
    if (error.status >= 500) return copy.serverError
    return copy.unknownError
  }
  if (error instanceof TypeError) return copy.networkError
  return copy.unknownError
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p
      id={`${id}-error`}
      className="-mt-0.5 text-xs leading-[1.4] text-[#a92d43]"
      role="alert"
    >
      {message}
    </p>
  ) : null
}

const photos = [
  "/auth/community-1.png",
  "/auth/community-2.png",
  "/auth/community-3.png",
]

function Brand() {
  return (
    <img
      className="mx-auto mb-0.5 block h-[69px] w-[134px] object-contain"
      src="/auth/exp-logo.svg"
      alt="EXP"
    />
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      {visible && (
        <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.7" />
      )}
    </svg>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  minLength,
  error,
  recoveryLink = false,
  copy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  autoComplete: string
  minLength?: number
  error?: string
  recoveryLink?: boolean
  copy: AuthCopy
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className={fieldClass}>
      <div className="flex items-baseline justify-between gap-3">
        <Label
          className={`${labelClass} ${id === "password" ? "font-normal" : ""}`}
          htmlFor={id}
        >
          {label}
        </Label>
        {recoveryLink && (
          <Link
            className="text-[13px] font-semibold text-[#1452ad] no-underline hover:underline"
            to="/forgot-password"
          >
            {copy.forgotPassword}
          </Link>
        )}
      </div>
      <div className="relative">
        <Input
          className={`${inputClass} pr-12`}
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="••••••••••••"
          required
        />
        <Button
          className={`absolute top-0 right-0 grid h-[47px] w-11 place-items-center border-0 bg-transparent p-0 text-[#8b9fc0] shadow-none hover:bg-transparent hover:text-[#8b9fc0] [&_svg]:size-[19px] ${focusOutline}`}
          variant="outline"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? copy.hidePassword : copy.showPassword} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          <EyeIcon visible={visible} />
        </Button>
      </div>
      <FieldError id={id} message={error} />
    </div>
  )
}

function PhotoPanel({
  mode,
  copy,
  language,
}: {
  mode: Mode
  copy: AuthCopy
  language: AuthLanguage
}) {
  const [active, setActive] = useState(0)
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
      className="relative min-h-svh overflow-hidden rounded-r-[26px] bg-[#173456] max-[850px]:hidden"
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
      <div className="absolute z-1 top-[37%] left-[clamp(42px,6.2%,90px)] w-[min(83%,650px)] text-white">
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
      </div>
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

function SocialPlaceholders({ copy }: { copy: AuthCopy }) {
  return (
    <div
      className="flex justify-center gap-4"
      aria-label={copy.socialComingSoon}
    >
      <span
        className={socialIconClass}
        title={copy.googleComingSoon}
        aria-hidden="true"
      >
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
      </span>
      <span
        className={`${socialIconClass} text-[#3264d8]`}
        title={copy.facebookComingSoon}
        aria-hidden="true"
      >
        f
      </span>
      <span
        className={`${socialIconClass} text-[#111]`}
        title={copy.appleComingSoon}
        aria-hidden="true"
      >
        <svg className="size-[21px]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.7 12.9c0-2 1.6-2.9 1.7-3-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8s-1.6-.8-2.6-.8c-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.7-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.2-.1 0-1.9-.7-1.9-2.5ZM15.4 6.8c.6-.7 1-1.6.9-2.6-.9 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.5 1 .1 1.9-.5 2.5-1.2Z" />
        </svg>
      </span>
    </div>
  )
}

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
      className="relative z-5 mr-1 text-[#26395e] max-[420px]:text-xs"
      ref={rootRef}
    >
      <button
        ref={triggerRef}
        className={`group inline-flex min-h-11 items-center gap-2 rounded-lg border-0 bg-transparent px-2 font-[inherit] text-inherit cursor-pointer hover:bg-[#f1f4fa] aria-expanded:bg-[#f1f4fa] ${focusOutline}`}
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
          className="absolute top-[calc(100%+6px)] left-0 w-40 rounded-xl border border-[#d7dfed] bg-white p-[5px] shadow-[0_12px_32px_rgb(20_45_97_/_13%)]"
          role="menu"
          aria-label={copy.language}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
          }}
        >
          <button
            ref={englishRef}
            className={`flex min-h-11 w-full items-center justify-between rounded-lg border-0 bg-transparent px-[11px] text-left font-[inherit] text-[#26395e] cursor-pointer hover:bg-[#eef1f8] focus-visible:bg-[#eef1f8] aria-checked:font-semibold aria-checked:text-[#153e92] ${focusOutline}`}
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
            className={`flex min-h-11 w-full items-center justify-between rounded-lg border-0 bg-transparent px-[11px] text-left font-[inherit] text-[#26395e] cursor-pointer hover:bg-[#eef1f8] focus-visible:bg-[#eef1f8] aria-checked:font-semibold aria-checked:text-[#153e92] ${focusOutline}`}
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

export function AuthPage({
  mode,
  onLoggedIn,
}: {
  mode: Mode
  onLoggedIn: () => void
}) {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [language, setLanguage] = useState<AuthLanguage>(getStoredAuthLanguage)
  const copy = getAuthCopy(language)
  const [fullName, setFullName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [pending, setPending] = useState(false)

  const errors = validateAuth(
    mode,
    { fullName, contactNumber, email, password, confirmPassword },
    copy,
  )
  const visibleError = (field: Field) =>
    submitted || touched[field] ? errors[field] : undefined

  function markTouched(field: Field) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function changeValue(setValue: (value: string) => void, value: string) {
    setValue(value)
    setFormError("")
  }

  function changeLanguage(next: AuthLanguage) {
    setLanguage(next)
    setFormError("")
    storeAuthLanguage(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setSubmitted(true)
    setFormError("")
    const firstInvalid = (Object.keys(fieldIds) as Field[]).find(
      (field) => errors[field],
    )
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#${fieldIds[firstInvalid]}`)
        ?.focus()
      return
    }
    setPending(true)
    try {
      if (mode === "login") {
        await signIn(email.trim(), password)
        onLoggedIn()
      } else {
        await register({
          fullName: fullName.trim(),
          contactNumber: contactNumber.trim(),
          email: email.trim(),
          password,
        })
        navigate("/dashboard", { replace: true })
        sileo.success({
          title: copy.accountCreated,
          description: copy.welcomeToExp,
        })
      }
    } catch (caught) {
      const message = requestErrorMessage(caught, mode, copy)
      if (
        caught instanceof ApiError &&
        (caught.status === 400 ||
          (mode === "register" && caught.status === 409))
      ) {
        setFormError(message)
      } else {
        sileo.error({
          title:
            mode === "login"
              ? caught instanceof ApiError && caught.status === 401
                ? copy.signInFailed
                : copy.signInUnavailable
              : copy.accountUnavailable,
          description: message,
        })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main
      className="grid min-h-svh grid-cols-[minmax(0,60%)_minmax(420px,40%)] bg-white text-[#121b28] max-[1100px]:grid-cols-[minmax(0,55%)_minmax(400px,45%)] max-[850px]:block"
      lang={language === "fil" ? "fil" : "en"}
    >
      <PhotoPanel mode={mode} copy={copy} language={language} />
      <section className="flex min-h-svh min-w-0 flex-col">
        <header className="flex h-[73px] items-center justify-center gap-[26px] px-6 text-[13px] max-[420px]:justify-end max-[420px]:gap-2.5 max-[420px]:px-[17px]">
          <LanguagePicker
            language={language}
            copy={copy}
            onChange={changeLanguage}
          />
          <nav
            className="flex items-center gap-0.5"
            aria-label={copy.accountNavigation}
          >
            <Link
              to="/login"
              className={`${navLinkClass} ${mode === "login" ? selectedNavClass : idleNavClass}`}
              aria-current={mode === "login" ? "page" : undefined}
            >
              {copy.signInLink}
            </Link>
            <Link
              to="/register"
              className={`${navLinkClass} ${mode === "register" ? selectedNavClass : idleNavClass}`}
              aria-current={mode === "register" ? "page" : undefined}
            >
              {copy.createAccountLink}
            </Link>
          </nav>
        </header>

        <div
          className={`flex flex-1 items-center justify-center px-8 pt-[26px] pb-[52px] max-[850px]:px-6 max-[850px]:pt-[30px] max-[850px]:pb-[58px] ${mode === "login" ? "min-[851px]:pt-12 min-[851px]:pb-[30px]" : ""}`}
        >
          <div className="w-[min(100%,384px)] min-w-0">
            <div className="text-center">
              <Brand />
              <h2 className="inline-block bg-[linear-gradient(90deg,#172735_0%,#246ea0_55%,#1cc5d0_100%)] bg-clip-text text-[25px] leading-[1.25] font-bold tracking-[-0.03em] text-transparent">
                {mode === "login" ? copy.loginTitle : copy.registerTitle}
              </h2>
              <p className="mt-[7px] text-sm leading-[1.4] text-[#5b709e]">
                {mode === "login" ? copy.loginSubtitle : copy.registerSubtitle}
              </p>
            </div>

            <form
              ref={formRef}
              className="mt-7 grid gap-5"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              {mode === "register" && (
                <>
                  <div className={fieldClass}>
                    <Label className={labelClass} htmlFor="full-name">
                      {copy.fullName}
                    </Label>
                    <Input
                      className={inputClass}
                      id="full-name"
                      type="text"
                      value={fullName}
                      onChange={(event) =>
                        changeValue(setFullName, event.target.value)
                      }
                      onBlur={() => markTouched("fullName")}
                      autoComplete="name"
                      minLength={2}
                      maxLength={100}
                      placeholder={copy.fullNamePlaceholder}
                      required
                      aria-invalid={Boolean(visibleError("fullName"))}
                      aria-describedby={
                        visibleError("fullName") ? "full-name-error" : undefined
                      }
                    />
                    <FieldError
                      id="full-name"
                      message={visibleError("fullName")}
                    />
                  </div>
                  <div className={fieldClass}>
                    <Label className={labelClass} htmlFor="contact-number">
                      {copy.contactNumber}
                    </Label>
                    <Input
                      className={inputClass}
                      id="contact-number"
                      type="tel"
                      value={contactNumber}
                      onChange={(event) =>
                        changeValue(setContactNumber, event.target.value)
                      }
                      onBlur={() => markTouched("contactNumber")}
                      autoComplete="tel"
                      placeholder="+63"
                      required
                      aria-invalid={Boolean(visibleError("contactNumber"))}
                      aria-describedby={
                        visibleError("contactNumber")
                          ? "contact-number-error"
                          : undefined
                      }
                    />
                    <FieldError
                      id="contact-number"
                      message={visibleError("contactNumber")}
                    />
                  </div>
                </>
              )}
              <div className={fieldClass}>
                <Label className={`${labelClass} font-normal`} htmlFor="email">
                  {copy.emailAddress}
                </Label>
                <Input
                  className={inputClass}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    changeValue(setEmail, event.target.value)
                  }
                  onBlur={() => markTouched("email")}
                  autoComplete="email"
                  placeholder="user@email.com"
                  required
                  aria-invalid={Boolean(visibleError("email"))}
                  aria-describedby={
                    visibleError("email") ? "email-error" : undefined
                  }
                />
                <FieldError id="email" message={visibleError("email")} />
              </div>
              {mode === "login" ? (
                <PasswordField
                  id="password"
                  label={copy.password}
                  value={password}
                  onChange={(value) => changeValue(setPassword, value)}
                  onBlur={() => markTouched("password")}
                  autoComplete="current-password"
                  error={visibleError("password")}
                  recoveryLink
                  copy={copy}
                />
              ) : (
                <div
                  className={`grid gap-4 max-[420px]:grid-cols-1 max-[420px]:gap-5 [&_label]:whitespace-nowrap ${language === "fil" ? "grid-cols-1" : "grid-cols-2"}`}
                >
                  <PasswordField
                    id="password"
                    label={copy.password}
                    value={password}
                    onChange={(value) => changeValue(setPassword, value)}
                    onBlur={() => markTouched("password")}
                    autoComplete="new-password"
                    minLength={12}
                    error={visibleError("password")}
                    copy={copy}
                  />
                  <PasswordField
                    id="confirm-password"
                    label={copy.confirmPassword}
                    value={confirmPassword}
                    onChange={(value) => changeValue(setConfirmPassword, value)}
                    onBlur={() => markTouched("confirmPassword")}
                    autoComplete="new-password"
                    minLength={12}
                    error={visibleError("confirmPassword")}
                    copy={copy}
                  />
                </div>
              )}
              {mode === "register" && (
                <p className="-mt-[11px] -mb-[6px] text-xs text-[#6b7e9f]">
                  {copy.passwordHint}
                </p>
              )}
              {formError && (
                <p
                  className="-my-[3px] rounded-lg bg-[#fff0f0] px-3 py-2.5 text-[13px] leading-[1.4] text-[#a1293d]"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              <Button
                className={`grid h-[46px] w-full place-items-center rounded-md border-0 bg-[#253f8c] text-sm font-bold text-white transition-[background,transform] duration-150 hover:bg-[#1a3276] hover:enabled:-translate-y-px disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none ${focusOutline}`}
                type="submit"
                disabled={pending}
              >
                {pending
                  ? mode === "login"
                    ? copy.signingIn
                    : copy.creatingAccount
                  : mode === "login"
                    ? copy.signInButton
                    : copy.createAccountButton}
              </Button>
            </form>

            <div className="mt-[23px] mb-[13px] flex items-center gap-4 text-xs text-[#7485a7] before:h-px before:flex-1 before:bg-[#dce4ee] before:content-[''] after:h-px after:flex-1 after:bg-[#dce4ee] after:content-['']">
              <span>{copy.or}</span>
            </div>
            <p className="mb-3 text-center text-[13px] leading-[1.4] text-[#7485a7]">
              {copy.continueWith}
            </p>
            <SocialPlaceholders copy={copy} />
          </div>
        </div>

        <footer className="flex min-h-14 items-center justify-center gap-4 px-5 py-3 text-xs text-[#52688d] whitespace-nowrap max-[420px]:flex-wrap max-[420px]:gap-x-3 max-[420px]:gap-y-[5px] max-[420px]:leading-[1.4]">
          <span>{copy.about}</span>
          <span>{copy.terms}</span>
          <span>{copy.privacy}</span>
          <span>{copy.cookies}</span>
          <span>{copy.copyright}</span>
        </footer>
      </section>
    </main>
  )
}
