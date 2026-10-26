import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { ApiError, register, signIn } from "../api/auth-api"
import type { AuthCopy } from "../content/auth-copy"
import { requestErrorMessage } from "../api/auth-errors"
import { Brand, PasswordField, TextField } from "./auth-fields"
import { focusOutline } from "../styles/auth-styles"
import {
  fieldIds,
  validateAuth,
  visibleFieldAfterInteraction,
  type Field,
} from "../model/schema"
import type { AuthLanguage, AuthMode } from "../model/types"
import { SocialSignInButtons } from "./auth-visuals"

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
  const [visibleErrorField, setVisibleErrorField] = useState<Field | null>(null)
  const [pending, setPending] = useState(false)

  const errors = validateAuth(
    mode,
    { fullName, contactNumber, email, password, confirmPassword },
    copy,
  )
  const visibleError = (field: Field) =>
    visibleErrorField === field ? errors[field] : undefined
  const currentFormError =
    formError?.language === language ? formError.message : undefined

  function markTouched(field: Field) {
    setVisibleErrorField((current) =>
      visibleFieldAfterInteraction(current, {
        type: "blur",
        field,
        invalid: Boolean(errors[field]),
      }),
    )
  }

  function handleFieldFocus(field: Field) {
    setVisibleErrorField((current) =>
      visibleFieldAfterInteraction(current, { type: "focus", field }),
    )
  }

  function changeValue(setValue: (value: string) => void, value: string) {
    setValue(value)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setFormError(null)
    const firstInvalid = (Object.keys(fieldIds) as Field[]).find(
      (field) => errors[field],
    )
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLInputElement>(`#${fieldIds[firstInvalid]}`)
        ?.focus()
      setVisibleErrorField(firstInvalid)
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
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[850px]:overflow-visible max-[850px]:px-6">
      <motion.div
        className={`my-auto w-full max-w-[400px] min-w-0 max-[850px]:pt-8 max-[850px]:pb-14 ${mode === "register" ? "py-0" : "py-12"}`}
        initial={reduceMotion ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="text-center">
          <Brand />
          <h2 className="inline-block bg-[linear-gradient(90deg,#172735_0%,#246ea0_55%,#1cc5d0_100%)] bg-clip-text text-[25px] leading-[1.25] font-bold tracking-[-0.03em] text-transparent">
            {mode === "login" ? copy.loginTitle : copy.registerTitle}
          </h2>
          <p className="mt-0 text-sm leading-[1.4] text-[#5b709e]">
            {mode === "login" ? copy.loginSubtitle : copy.registerSubtitle}
          </p>
        </div>

        <form
          ref={formRef}
          className={`grid gap-2 ${mode === "register" ? "mt-7" : "mt-9"}`}
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
        >
          {mode === "register" && (
            <div className="grid grid-cols-2 items-start gap-3 max-[420px]:grid-cols-1">
              <TextField
                id="full-name"
                label={copy.fullName}
                type="text"
                value={fullName}
                onChange={(value) => changeValue(setFullName, value)}
                onBlur={() => markTouched("fullName")}
                onFocus={() => handleFieldFocus("fullName")}
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
                onFocus={() => handleFieldFocus("contactNumber")}
                autoComplete="tel"
                placeholder="+63"
                error={visibleError("contactNumber")}
              />
            </div>
          )}
          <TextField
            id="email"
            label={copy.emailAddress}
            type="email"
            value={email}
            onChange={(value) => changeValue(setEmail, value)}
            onBlur={() => markTouched("email")}
            onFocus={() => handleFieldFocus("email")}
            autoComplete="email"
            placeholder="user@email.com"
            error={visibleError("email")}
          />
          {mode === "login" ? (
            <PasswordField
              id="password"
              label={copy.password}
              value={password}
              onChange={(value) => changeValue(setPassword, value)}
              onBlur={() => markTouched("password")}
              onFocus={() => handleFieldFocus("password")}
              autoComplete="current-password"
              error={visibleError("password")}
              recoveryLink
              copy={copy}
            />
          ) : (
            <div className="grid grid-cols-2 items-start gap-3 max-[420px]:grid-cols-1 [&_label]:whitespace-nowrap">
              <PasswordField
                id="password"
                label={copy.password}
                value={password}
                onChange={(value) => changeValue(setPassword, value)}
                onBlur={() => markTouched("password")}
                onFocus={() => handleFieldFocus("password")}
                autoComplete="new-password"
                minLength={12}
                error={visibleError("password")}
                helperText={
                  mode === "register" && !visibleError("password")
                    ? copy.passwordHint
                    : undefined
                }
                copy={copy}
              />
              <PasswordField
                id="confirm-password"
                label={copy.confirmPassword}
                value={confirmPassword}
                onChange={(value) => changeValue(setConfirmPassword, value)}
                onBlur={() => markTouched("confirmPassword")}
                onFocus={() => handleFieldFocus("confirmPassword")}
                autoComplete="new-password"
                minLength={12}
                error={visibleError("confirmPassword")}
                copy={copy}
              />
            </div>
          )}
          {currentFormError && (
            <p
              className="-my-[3px] rounded-lg bg-[#fff0f0] px-3 py-2.5 text-[13px] leading-[1.4] text-[#a1293d]"
              role="alert"
            >
              {currentFormError}
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

        <div
          className={`flex items-center gap-4 text-xs text-[#7485a7] before:h-px before:flex-1 before:bg-[#dce4ee] before:content-[''] after:h-px after:flex-1 after:bg-[#dce4ee] after:content-[''] ${mode === "register" ? "mt-2 mb-2" : "mt-8 mb-4"}`}
        >
          <span>{copy.or}</span>
        </div>
        <p
          className={`text-center text-[13px] leading-[1.4] text-[#7485a7] ${mode === "register" ? "mb-2" : "mb-3"}`}
        >
          {copy.continueWith}
        </p>
        <SocialSignInButtons copy={copy} />
        <p
          className={`text-center text-sm leading-[1.4] text-[#52688d] ${mode === "register" ? "mt-2" : "mt-6"}`}
        >
          {mode === "login" ? copy.noAccountYet : copy.haveAccountYet}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className={`font-semibold text-[#253f8c] underline-offset-2 hover:underline ${focusOutline}`}
          >
            {mode === "login" ? copy.createOne : copy.signInHere}
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
