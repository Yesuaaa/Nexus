import { useEffect, useRef, useState, type FormEvent } from "react"
import { cn } from "@/lib/utils"
import { ApiError } from "@/features/auth/api/auth-api"
import { createAccount, type AccountRole } from "../api/accounts-api"
import { AccountDropdown } from "./account-dropdown"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountField,
  accountFocusRing,
  accountInput,
} from "../styles/account-styles"

const roleNames: Record<AccountRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  STAFF: "Staff",
  USER: "User",
}

const NAME_RE = /^\p{L}[\p{L} .'’-]*$/u
const EMAIL_RE =
  /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|ph)$/i
const PHONE_RE = /^0[89]\d{9}$/

type FieldName =
  "email" | "fullName" | "contactNumber" | "password" | "confirmation"
type Values = Record<FieldName, string>

const emptyValues: Values = {
  email: "",
  fullName: "",
  contactNumber: "",
  password: "",
  confirmation: "",
}

function validate(values: Values): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {}
  const email = values.email.trim()
  const name = values.fullName.trim()
  const phone = values.contactNumber
  const { password, confirmation } = values

  if (!email) errors.email = "Email address is required."
  else if (!EMAIL_RE.test(email))
    errors.email = "Enter a valid email like name@example.com."

  if (!name) errors.fullName = "Full name is required."
  else if (name.length < 2)
    errors.fullName = "Full name must be at least 2 characters."
  else if (!NAME_RE.test(name))
    errors.fullName = "Letters, spaces, hyphens, apostrophes and periods only."

  if (phone && !PHONE_RE.test(phone))
    errors.contactNumber = "Enter 11 digits starting with 09 or 08."

  if (!password) errors.password = "Password is required."
  else if (password.length < 12) errors.password = "Use at least 12 characters."
  else if (!/[A-Z]/.test(password))
    errors.password = "Include at least one capital letter."
  else if (!/[a-z]/.test(password))
    errors.password = "Include at least one lowercase letter."
  else if (!/[0-9]/.test(password))
    errors.password = "Include at least one number."
  else if (!/[^A-Za-z0-9]/.test(password))
    errors.password = "Include at least one special character."

  if (!confirmation) errors.confirmation = "Please confirm your password."
  else if (password !== confirmation)
    errors.confirmation = "Passwords do not match."

  return errors
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="m4 4 16 16" />}
    </svg>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="m-0 text-[11px] font-normal text-[#bc3649]">{message}</p>
}

export function CreateAccountDialog({
  open,
  roles,
  onClose,
  onCreated,
}: {
  open: boolean
  roles: AccountRole[]
  onClose: () => void
  onCreated: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [role, setRole] = useState<AccountRole>("USER")
  const [values, setValues] = useState<Values>(emptyValues)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {},
  )
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const errors = validate(values)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function resetForm() {
    setValues(emptyValues)
    setTouched({})
    setSubmitted(false)
    setShowPassword(false)
    setShowConfirmation(false)
    setRole("USER")
    setError("")
  }

  function closeDialog() {
    resetForm()
    onClose()
  }

  function showError(field: FieldName) {
    const hasValue = values[field].length > 0
    return hasValue || touched[field] || submitted ? errors[field] : undefined
  }

  function setField(field: FieldName, value: string) {
    const next = field === "contactNumber" ? value.replace(/\D/g, "") : value
    setValues((current) => ({ ...current, [field]: next }))
  }

  function blurField(field: FieldName) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  function inputClass(field: FieldName) {
    return cn(
      accountInput,
      showError(field) && [
        "border-[#d64557] focus:border-[#d64557] focus-visible:border-[#d64557]",
        "outline-none focus:outline-none focus-visible:outline-none",
        "focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none",
      ],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    setError("")
    try {
      await createAccount({
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        contactNumber: values.contactNumber || undefined,
        password: values.password,
        role,
      })
      onCreated()
      closeDialog()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't create the account. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto max-h-[min(90dvh,780px)] w-[min(520px,calc(100vw-28px))] overflow-y-auto rounded-2xl border border-[#dce4f0] bg-background p-0 font-sans text-sm text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)] backdrop:bg-[rgb(13_28_57_/_48%)]"
      aria-labelledby="create-account-title"
      onClose={closeDialog}
    >
      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex justify-between gap-4 border-b border-[#e9edf4] px-7 pt-[26px] pb-5 max-[560px]:px-5">
          <div>
            <p className="mt-0 mb-2 text-[11px] font-bold tracking-[0.09em] text-[#32549a]">
              NEW ACCOUNT
            </p>
            <h2
              id="create-account-title"
              className="m-0 text-[22px] tracking-[-0.03em]"
            >
              Create account
            </h2>
            <p className="mt-[5px] mb-0 text-[#7183a2]">
              Set up an account and assign its portal access.
            </p>
          </div>
          <button
            type="button"
            className={cn(
              "size-[30px] flex-none cursor-pointer rounded-[7px] border-0 bg-[#f3f6fa] text-[23px] leading-none text-[#526686]",
              accountFocusRing,
            )}
            aria-label="Close"
            onClick={closeDialog}
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 items-start gap-x-[14px] gap-y-[17px] px-7 py-[22px] max-[560px]:grid-cols-1 max-[560px]:p-5">
          <label className={accountField}>
            <span>
              Email address <strong>*</strong>
            </span>
            <input
              className={inputClass("email")}
              name="email"
              type="email"
              autoComplete="off"
              maxLength={254}
              autoFocus
              placeholder="name@example.com"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              onBlur={() => blurField("email")}
              aria-invalid={Boolean(showError("email"))}
            />
            <FieldError message={showError("email")} />
          </label>
          <label className={accountField}>
            <span>
              Full name <strong>*</strong>
            </span>
            <input
              className={inputClass("fullName")}
              name="fullName"
              type="text"
              maxLength={100}
              autoComplete="off"
              placeholder="Full name"
              value={values.fullName}
              onChange={(event) => setField("fullName", event.target.value)}
              onBlur={() => blurField("fullName")}
              aria-invalid={Boolean(showError("fullName"))}
            />
            <FieldError message={showError("fullName")} />
          </label>
          <label className={accountField}>
            <span>Contact number</span>
            <input
              className={inputClass("contactNumber")}
              name="contactNumber"
              type="tel"
              inputMode="numeric"
              maxLength={11}
              autoComplete="off"
              placeholder="Optional"
              value={values.contactNumber}
              onChange={(event) =>
                setField("contactNumber", event.target.value)
              }
              onBlur={() => blurField("contactNumber")}
              aria-invalid={Boolean(showError("contactNumber"))}
            />
            <FieldError message={showError("contactNumber")} />
          </label>
          <div className={accountField}>
            <span>
              Role <strong>*</strong>
            </span>
            <AccountDropdown
              triggerClassName="h-10 border-[#d6dfec] text-foreground"
              label="Role"
              value={role}
              onChange={setRole}
              options={roles.map((option) => ({
                value: option,
                label: roleNames[option],
              }))}
            />
          </div>
          <label className={accountField}>
            <span>
              Password <strong>*</strong>
            </span>
            <div className="relative">
              <input
                className={cn(inputClass("password"), "pr-10")}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={1024}
                placeholder="At least 12 characters"
                value={values.password}
                onChange={(event) => setField("password", event.target.value)}
                onBlur={() => blurField("password")}
                aria-invalid={Boolean(showError("password"))}
              />
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#7183a2] hover:text-[#32549a]",
                  accountFocusRing,
                )}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            <FieldError message={showError("password")} />
          </label>
          <label className={accountField}>
            <span>
              Confirm password <strong>*</strong>
            </span>
            <div className="relative">
              <input
                className={cn(inputClass("confirmation"), "pr-10")}
                name="confirmation"
                type={showConfirmation ? "text" : "password"}
                autoComplete="new-password"
                maxLength={1024}
                placeholder="Repeat password"
                value={values.confirmation}
                onChange={(event) =>
                  setField("confirmation", event.target.value)
                }
                onBlur={() => blurField("confirmation")}
                aria-invalid={Boolean(showError("confirmation"))}
              />
              <button
                type="button"
                className={cn(
                  "absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#7183a2] hover:text-[#32549a]",
                  accountFocusRing,
                )}
                aria-label={
                  showConfirmation ? "Hide password" : "Show password"
                }
                onClick={() => setShowConfirmation((current) => !current)}
              >
                <EyeIcon off={showConfirmation} />
              </button>
            </div>
            <FieldError message={showError("confirmation")} />
          </label>
        </div>

        {error && (
          <p className="mx-7 mt-0 mb-3 text-xs text-[#bc3649]" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-[9px] border-t border-[#e9edf4] px-7 pt-[18px] pb-6 max-[560px]:px-5">
          <button
            type="button"
            className={cn(accountButton, accountButtonSecondary)}
            onClick={closeDialog}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={cn(accountButton, accountButtonPrimary)}
            disabled={saving}
          >
            {saving ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </dialog>
  )
}
