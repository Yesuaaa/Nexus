import { useRef, useState, type FormEvent } from "react"
import { Link } from "react-router"
import { motion, useReducedMotion } from "framer-motion"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ApiError, register, signIn } from "../api"
import type { AuthCopy } from "../copy"
import { requestErrorMessage } from "../errors"
import { Brand, PasswordField, TextField } from "./fields"
import { focusOutline } from "./styles"
import { fieldIds, validateAuth, type Field } from "../schema"
import type { AuthLanguage, AuthMode } from "../types"
import { SocialPlaceholders } from "./visuals"

export function AuthContent({
  mode,
  copy,
  language,
  onLoggedIn,
}: {
  mode: AuthMode
  copy: AuthCopy
  language: AuthLanguage
  onLoggedIn: (mode: AuthMode) => void
}) {
  const reduceMotion = useReducedMotion()
  const formRef = useRef<HTMLFormElement>(null)
  const [fullName, setFullName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState<{
    language: AuthLanguage
    message: string
  } | null>(null)
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
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setSubmitted(true)
    setFormError(null)
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
        onLoggedIn("login")
      } else {
        await register({
          fullName: fullName.trim(),
          contactNumber: contactNumber.trim(),
          email: email.trim(),
          password,
        })
        onLoggedIn("register")
      }
    } catch (caught) {
      const message = requestErrorMessage(caught, mode, copy)
      if (
        caught instanceof ApiError &&
        (caught.status === 400 ||
          (mode === "register" && caught.status === 409))
      ) {
        setFormError({ language, message })
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
    <div
      className={`flex flex-1 items-center justify-center px-8 pt-[26px] pb-[52px] max-[850px]:px-6 max-[850px]:pt-[30px] max-[850px]:pb-[58px] ${mode === "login" ? "min-[851px]:pt-12 min-[851px]:pb-[30px]" : ""}`}
    >
      <motion.div
        className="w-[min(100%,384px)] min-w-0"
        initial={reduceMotion ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
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
              <TextField
                id="full-name"
                label={copy.fullName}
                type="text"
                value={fullName}
                onChange={(value) => changeValue(setFullName, value)}
                onBlur={() => markTouched("fullName")}
                autoComplete="name"
                minLength={2}
                maxLength={100}
                placeholder={copy.fullNamePlaceholder}
                error={visibleError("fullName")}
              />
              <TextField
                id="contact-number"
                label={copy.contactNumber}
                type="tel"
                value={contactNumber}
                onChange={(value) => changeValue(setContactNumber, value)}
                onBlur={() => markTouched("contactNumber")}
                autoComplete="tel"
                placeholder="+63"
                error={visibleError("contactNumber")}
              />
            </>
          )}
          <TextField
            id="email"
            label={copy.emailAddress}
            type="email"
            value={email}
            onChange={(value) => changeValue(setEmail, value)}
            onBlur={() => markTouched("email")}
            autoComplete="email"
            placeholder="user@email.com"
            error={visibleError("email")}
            normalWeight
          />
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
              className={`grid items-start gap-4 max-[420px]:grid-cols-1 max-[420px]:gap-5 [&_label]:whitespace-nowrap ${language === "fil" ? "grid-cols-1" : "grid-cols-2"}`}
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
          {mode === "register" && !visibleError("password") && (
            <p className="-mt-[11px] -mb-[6px] text-xs text-[#6b7e9f]">
              {copy.passwordHint}
            </p>
          )}
          {formError?.language === language && (
            <p
              className="-my-[3px] rounded-lg bg-[#fff0f0] px-3 py-2.5 text-[13px] leading-[1.4] text-[#a1293d]"
              role="alert"
            >
              {formError.message}
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
        <p className="mt-6 text-center text-sm leading-[1.4] text-[#52688d]">
          {mode === "login" ? copy.noAccountYet : copy.haveAccountYet}{" "}
          <Link
            to={mode === "login" ? "/register" : "/login"}
            className={`font-semibold text-[#253f8c] underline-offset-2 hover:underline ${focusOutline}`}
          >
            {mode === "login" ? copy.createOne : copy.signInHere}
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
