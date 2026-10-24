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
import "./auth.css"

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
    <p id={`${id}-error`} className="auth-field-error" role="alert">
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
  return <img className="auth-brand" src="/auth/exp-logo.svg" alt="EXP" />
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
    <div className="auth-field">
      <div className="auth-field-heading">
        <Label htmlFor={id}>{label}</Label>
        {recoveryLink && (
          <Link className="auth-recovery-link" to="/forgot-password">
            {copy.forgotPassword}
          </Link>
        )}
      </div>
      <div className="auth-password-wrap">
        <Input
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
          className="auth-eye-button h-[47px] w-11 border-0 bg-transparent p-0 text-[#8b9fc0] shadow-none hover:bg-transparent hover:text-[#8b9fc0]"
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

function PhotoPanel({ mode, copy }: { mode: Mode; copy: AuthCopy }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % photos.length),
      6000,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <aside className="auth-visual" aria-label={copy.community}>
      {photos.map((src, index) => (
        <img
          key={src}
          className={`auth-photo ${index === active ? "is-active" : ""}`}
          src={src}
          alt=""
          aria-hidden="true"
        />
      ))}
      <div className="auth-visual-shade" />
      <div className="auth-visual-copy">
        {mode === "login" ? (
          <>
            <h1>
              {copy.loginHeroLine1}
              <br />
              <span>{copy.loginHeroLine2}</span>
              <br />
              {copy.loginHeroLine3}
            </h1>
            <p>{copy.loginHeroDescription}</p>
          </>
        ) : (
          <>
            <h1>
              {copy.registerHeroLine1}
              <br />
              <span>{copy.registerHeroLine2}</span>
              <br />
              {copy.registerHeroLine3}
            </h1>
            <p>{copy.registerHeroDescription}</p>
          </>
        )}
      </div>
      <div className="auth-dots" aria-label={copy.choosePhoto}>
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            className={index === active ? "is-active" : ""}
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
    <div className="auth-social" aria-label={copy.socialComingSoon}>
      <span
        className="auth-social-google"
        title={copy.googleComingSoon}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
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
        className="auth-social-facebook"
        title={copy.facebookComingSoon}
        aria-hidden="true"
      >
        f
      </span>
      <span
        className="auth-social-apple"
        title={copy.appleComingSoon}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
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
    <div className="auth-language" ref={rootRef}>
      <button
        ref={triggerRef}
        className="auth-language-trigger"
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
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m3 6 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="auth-language-menu"
          role="menu"
          aria-label={copy.language}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false)
          }}
        >
          <button
            ref={englishRef}
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
      className={`auth-page${mode === "login" ? " auth-page--login" : ""}`}
      lang={language === "fil" ? "fil" : "en"}
    >
      <PhotoPanel mode={mode} copy={copy} />
      <section className="auth-right">
        <header className="auth-header">
          <LanguagePicker
            language={language}
            copy={copy}
            onChange={changeLanguage}
          />
          <nav className="auth-nav" aria-label={copy.accountNavigation}>
            {mode === "login" ? (
              <Link to="/register" className="auth-account-link">
                {copy.createAccountLink}
              </Link>
            ) : (
              <Link to="/login" className="auth-account-link">
                {copy.signInLink}
              </Link>
            )}
          </nav>
        </header>

        <div className="auth-content">
          <div className="auth-card">
            <div className="auth-intro">
              <Brand />
              <h2>{mode === "login" ? copy.loginTitle : copy.registerTitle}</h2>
              <p>
                {mode === "login" ? copy.loginSubtitle : copy.registerSubtitle}
              </p>
            </div>

            <form
              ref={formRef}
              className="auth-form"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              {mode === "register" && (
                <>
                  <div className="auth-field">
                    <Label htmlFor="full-name">{copy.fullName}</Label>
                    <Input
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
                  <div className="auth-field">
                    <Label htmlFor="contact-number">{copy.contactNumber}</Label>
                    <Input
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
              <div className="auth-field">
                <Label htmlFor="email">{copy.emailAddress}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    changeValue(setEmail, event.target.value)
                  }
                  onBlur={() => markTouched("email")}
                  autoComplete="email"
                  placeholder="you@example.com"
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
                <div className="auth-password-pair">
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
                <p className="auth-password-hint">{copy.passwordHint}</p>
              )}
              {formError && (
                <p className="auth-error" role="alert">
                  {formError}
                </p>
              )}
              <Button
                className="auth-submit h-[46px] w-full rounded-[6px] bg-[#253f8c] text-sm font-bold text-white hover:bg-[#1a3276]"
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

            <div className="auth-divider">
              <span>{copy.or}</span>
            </div>
            <p className="auth-social-label">{copy.continueWith}</p>
            <SocialPlaceholders copy={copy} />
          </div>
        </div>

        <footer className="auth-footer">
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
