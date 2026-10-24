import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, register, signIn } from "@/lib/auth"
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

function validateAuth(mode: Mode, values: Record<Field, string>): FieldErrors {
  const errors: FieldErrors = {}
  const email = values.email.trim()

  if (mode === "register") {
    const name = values.fullName.trim()
    const contact = values.contactNumber.trim()
    if (!name) errors.fullName = "Enter your full name."
    else if (name.length < 2 || name.length > 100)
      errors.fullName = "Name must be 2 to 100 characters."

    if (!contact) errors.contactNumber = "Enter your contact number."
    else if (!/^\+?[0-9][0-9\s-]{6,19}$/.test(contact))
      errors.contactNumber = "Enter a valid number, such as +63 912 345 6789."
  }

  if (!email) errors.email = "Enter your email address."
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address, such as name@example.com."

  if (!values.password) errors.password = "Enter your password."
  else if (mode === "register" && values.password.length < 12)
    errors.password = "Use at least 12 characters for your password."
  else if (new TextEncoder().encode(values.password).length > 1024)
    errors.password = "Password is too long. Use fewer characters."

  if (mode === "register") {
    if (!values.confirmPassword)
      errors.confirmPassword = "Confirm your password."
    else if (values.confirmPassword !== values.password)
      errors.confirmPassword =
        "Passwords do not match. Enter the same password."
  }

  return errors
}

function requestErrorMessage(error: unknown, mode: Mode): string {
  if (error instanceof ApiError) {
    if (mode === "login" && error.status === 401)
      return "Email or password is incorrect. Please try again."
    if (mode === "register" && error.status === 409)
      return "This email is already registered. Sign in instead."
    if (error.status === 429)
      return "Too many sign-in attempts. Please wait 15 minutes and try again."
    if (error.status >= 500)
      return "The server is having trouble. Please try again shortly."
    return error.message
  }
  if (error instanceof TypeError)
    return "Can't reach the server. Check your connection and try again."
  return "Something went wrong. Please try again."
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
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  autoComplete: string
  minLength?: number
  error?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
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
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          <EyeIcon visible={visible} />
        </Button>
      </div>
      <FieldError id={id} message={error} />
    </div>
  )
}

function PhotoPanel({ mode }: { mode: Mode }) {
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
    <aside className="auth-visual" aria-label="EXP community">
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
              Empower Your
              <br />
              <span>Digital Solutions</span>
              <br />
              Journey
            </h1>
            <p>
              Access powerful tools and insights to drive your campaigns
              forward. Sign in to continue your EXP experience.
            </p>
          </>
        ) : (
          <>
            <h1>
              Join the
              <br />
              <span>EXP Community</span>
              <br />
              Today
            </h1>
            <p>
              Create your account to start managing bookings and services with
              EXP.
            </p>
          </>
        )}
      </div>
      <div className="auth-dots" aria-label="Choose photo">
        {photos.map((_, index) => (
          <button
            key={index}
            type="button"
            className={index === active ? "is-active" : ""}
            onClick={() => setActive(index)}
            aria-label={`Show photo ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
          />
        ))}
      </div>
    </aside>
  )
}

function SocialPlaceholders() {
  return (
    <div
      className="auth-social"
      aria-label="Social sign-in options coming soon"
    >
      <span
        className="auth-social-google"
        title="Google sign-in coming soon"
        aria-hidden="true"
      >
        G
      </span>
      <span
        className="auth-social-facebook"
        title="Facebook sign-in coming soon"
        aria-hidden="true"
      >
        f
      </span>
      <span
        className="auth-social-apple"
        title="Apple sign-in coming soon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.7 12.9c0-2 1.6-2.9 1.7-3-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8s-1.6-.8-2.6-.8c-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.7-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.2-.1 0-1.9-.7-1.9-2.5ZM15.4 6.8c.6-.7 1-1.6.9-2.6-.9 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.5 1 .1 1.9-.5 2.5-1.2Z" />
        </svg>
      </span>
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
  const [fullName, setFullName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [pending, setPending] = useState(false)

  const errors = validateAuth(mode, {
    fullName,
    contactNumber,
    email,
    password,
    confirmPassword,
  })
  const visibleError = (field: Field) =>
    submitted || touched[field] ? errors[field] : undefined

  function markTouched(field: Field) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function changeValue(setValue: (value: string) => void, value: string) {
    setValue(value)
    setFormError("")
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
          title: "Account created",
          description: "Welcome to EXP.",
        })
      }
    } catch (caught) {
      const message = requestErrorMessage(caught, mode)
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
                ? "Sign-in failed"
                : "Sign-in unavailable"
              : "Account unavailable",
          description: message,
        })
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="auth-page">
      <PhotoPanel mode={mode} />
      <section className="auth-right">
        <header className="auth-header">
          <span className="auth-language">English</span>
          <nav className="auth-nav" aria-label="Account">
            <Link to="/login" className={mode === "login" ? "is-active" : ""}>
              Sign In
            </Link>
            <Link
              to="/register"
              className={mode === "register" ? "is-active" : ""}
            >
              Register
            </Link>
          </nav>
        </header>

        <div className="auth-content">
          <div className="auth-card">
            <div className="auth-intro">
              <Brand />
              <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
              <p>
                {mode === "login"
                  ? "Sign in to your EXP account"
                  : "Begin your digital journey with EXP today."}
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
                    <Label htmlFor="full-name">Full Name</Label>
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
                      placeholder="John Doe"
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
                    <Label htmlFor="contact-number">Contact No.</Label>
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
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    changeValue(setEmail, event.target.value)
                  }
                  onBlur={() => markTouched("email")}
                  autoComplete="email"
                  placeholder="username@gmail.com"
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
                  label="Password"
                  value={password}
                  onChange={(value) => changeValue(setPassword, value)}
                  onBlur={() => markTouched("password")}
                  autoComplete="current-password"
                  error={visibleError("password")}
                />
              ) : (
                <div className="auth-password-pair">
                  <PasswordField
                    id="password"
                    label="Password"
                    value={password}
                    onChange={(value) => changeValue(setPassword, value)}
                    onBlur={() => markTouched("password")}
                    autoComplete="new-password"
                    minLength={12}
                    error={visibleError("password")}
                  />
                  <PasswordField
                    id="confirm-password"
                    label="Confirm Password"
                    value={confirmPassword}
                    onChange={(value) => changeValue(setConfirmPassword, value)}
                    onBlur={() => markTouched("confirmPassword")}
                    autoComplete="new-password"
                    minLength={12}
                    error={visibleError("confirmPassword")}
                  />
                </div>
              )}
              {mode === "register" && (
                <p className="auth-password-hint">
                  Use at least 12 characters.
                </p>
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
                    ? "Signing In…"
                    : "Creating Account…"
                  : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </form>

            <div className="auth-divider">
              <span>OR</span>
            </div>
            <SocialPlaceholders />
          </div>
        </div>

        <footer className="auth-footer">
          <span>About</span>
          <span>Terms of Use</span>
          <span>Privacy Policy</span>
          <span>Cookie Policy</span>
          <span>Copyright Policy</span>
        </footer>
      </section>
    </main>
  )
}
