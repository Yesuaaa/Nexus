import { Form } from "@/components/ui/form"
import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { sileo } from "@/lib/toast"
import { Button } from "@/components/ui/button"
import {
  ApiError,
  PortalAccessError,
  register,
  signInToPortal,
} from "../api/auth-api"
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
import type { AuthMode, AuthPortal } from "../model/types"

export function AuthContent({
  mode,
  portal,
  copy,
  onLoggedIn,
}: {
  mode: AuthMode
  portal: AuthPortal
  copy: AuthCopy
  onLoggedIn: (mode: AuthMode) => void
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const submissionInFlight = useRef(false)
  const [fullName, setFullName] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [visibleErrorField, setVisibleErrorField] = useState<Field | null>(null)
  const [pending, setPending] = useState(false)

  const errors = validateAuth(
    mode,
    { fullName, contactNumber, email, password, confirmPassword },
    copy,
  )
  const visibleError = (field: Field) =>
    visibleErrorField === field ? errors[field] : undefined

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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submissionInFlight.current) return
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
    submissionInFlight.current = true
    setPending(true)
    try {
      if (mode === "login") {
        await signInToPortal(email.trim(), password, portal)
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
      if (caught instanceof PortalAccessError) {
        sileo.error({
          title: copy.signInFailed,
          description:
            portal === "workforce"
              ? copy.workforceAccountRequired
              : copy.clientAccountRequired,
        })
        return
      }
      const message = requestErrorMessage(caught, mode, copy)
      // Submission failures belong in a toast; field validation stays beside
      // the relevant input so users can correct it in place.
      sileo.error({
        title:
          mode === "login"
            ? caught instanceof ApiError && caught.status === 401
              ? copy.signInFailed
              : copy.signInUnavailable
            : copy.accountUnavailable,
        description: message,
      })
    } finally {
      submissionInFlight.current = false
      setPending(false)
    }
  }

  return (
    <div
      className={
        portal === "workforce"
          ? "w-full max-w-[440px]"
          : "flex min-h-0 flex-1 justify-center overflow-y-auto px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[850px]:overflow-visible max-[850px]:px-6"
      }
    >
      <div
        className={
          portal === "workforce"
            ? "auth-form-enter w-full rounded-xl border border-border bg-card px-8 py-10 max-[420px]:px-6"
            : `auth-form-enter my-auto w-full max-w-[400px] min-w-0 max-[850px]:pt-8 max-[850px]:pb-14 ${mode === "register" ? "py-0" : "py-12"}`
        }
      >
        <div className="text-center">
          <Brand />
          <h2 className="inline-block bg-[linear-gradient(90deg,#172735_0%,#246ea0_55%,#1cc5d0_100%)] bg-clip-text text-[25px] leading-[1.25] font-bold tracking-[-0.03em] text-transparent">
            {mode === "register"
              ? copy.registerTitle
              : portal === "workforce"
                ? copy.workforceLoginTitle
                : copy.loginTitle}
          </h2>
          <p className="mt-0 text-sm leading-[1.4] text-[#5b709e]">
            {mode === "register"
              ? copy.registerSubtitle
              : portal === "workforce"
                ? copy.workforceLoginSubtitle
                : copy.loginSubtitle}
          </p>
        </div>

        <Form
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
                onChange={(value) =>
                  changeValue(setContactNumber, value.replace(/\D/g, ""))
                }
                onBlur={() => markTouched("contactNumber")}
                onFocus={() => handleFieldFocus("contactNumber")}
                autoComplete="tel"
                placeholder="09123456789"
                maxLength={11}
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
            maxLength={254}
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
          <Button
            className={`grid h-[46px] w-full place-items-center rounded-md border-0 bg-[#253f8c] text-sm font-bold text-white transition-[background,transform] duration-150 hover:bg-[#1a3276] hover:enabled:-translate-y-px disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none ${focusOutline} ${mode === "register" ? "mt-2" : ""}`}
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
        </Form>

        {portal === "client" && (
          <div className="mt-6 space-y-2 text-center text-sm leading-[1.4] text-[#52688d]">
            <p>
              {mode === "login" ? copy.noAccountYet : copy.haveAccountYet}{" "}
              <Link
                href={mode === "login" ? "/register" : "/login"}
                className={`font-semibold text-[#253f8c] underline-offset-2 hover:underline ${focusOutline}`}
              >
                {mode === "login" ? copy.createOne : copy.signInHere}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
