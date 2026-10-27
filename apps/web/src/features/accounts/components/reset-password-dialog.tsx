import { useEffect, useRef, useState, type FormEvent } from "react"
import { cn } from "@/lib/utils"
import type { Account } from "@/features/auth/model/types"
import { ApiError } from "@/features/auth/api/auth-api"
import { resetAccountPassword } from "../api/accounts-api"
import {
  validateStrongPassword,
  type PasswordField,
} from "../model/password-validation"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountField,
  accountFocusRing,
  accountInput,
} from "../styles/account-styles"

const emptyValues = { password: "", confirmation: "" }

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

export function ResetPasswordDialog({
  account,
  onClose,
  onReset,
}: {
  account: Account
  onClose: () => void
  onReset: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState(emptyValues)
  const [touched, setTouched] = useState<
    Partial<Record<PasswordField, boolean>>
  >({})
  const [submitted, setSubmitted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const errors = validateStrongPassword(values)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function resetForm() {
    setValues(emptyValues)
    setTouched({})
    setSubmitted(false)
    setShowPassword(false)
    setShowConfirmation(false)
    setError("")
  }

  function closeDialog() {
    if (saving) return
    resetForm()
    onClose()
  }

  function showError(field: PasswordField) {
    return values[field] || touched[field] || submitted
      ? errors[field]
      : undefined
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    setSaving(true)
    setError("")
    try {
      await resetAccountPassword(account.id, values.password)
      resetForm()
      onReset()
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't reset the password. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto w-[min(520px,calc(100vw-28px))] rounded-2xl border border-[#dce4f0] bg-background p-0 font-sans text-sm text-foreground shadow-[0_22px_75px_rgb(18_36_73_/_22%)] backdrop:bg-[rgb(13_28_57_/_48%)]"
      aria-labelledby="reset-password-title"
      onClose={closeDialog}
    >
      <form noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex justify-between gap-4 border-b border-[#e9edf4] px-7 pt-[26px] pb-5 max-[560px]:px-5">
          <div>
            <p className="mt-0 mb-2 text-[11px] font-bold tracking-[0.09em] text-[#32549a]">
              ACCOUNT SECURITY
            </p>
            <h2
              id="reset-password-title"
              className="m-0 text-[22px] tracking-[-0.03em]"
            >
              Reset password
            </h2>
            <p className="mt-[5px] mb-0 text-[#7183a2]">
              Set a new password for {account.fullName || account.email}.
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
            disabled={saving}
          >
            ×
          </button>
        </div>
        <div className="grid gap-[17px] px-7 py-[22px] max-[560px]:p-5">
          <div className="rounded-lg bg-[#f3f6fa] px-4 py-3 text-xs">
            <strong className="block text-foreground">
              {account.fullName || account.email.split("@")[0]}
            </strong>
            <span className="text-[#7183a2]">{account.email}</span>
          </div>
          {(["password", "confirmation"] as const).map((field) => {
            const visible =
              field === "password" ? showPassword : showConfirmation
            const message = showError(field)
            return (
              <label className={accountField} key={field}>
                <span>
                  {field === "password" ? "New password" : "Confirm password"}{" "}
                  <strong>*</strong>
                </span>
                <div className="relative">
                  <input
                    className={cn(
                      accountInput,
                      "pr-10",
                      message && "border-[#d64557] focus:border-[#d64557]",
                    )}
                    name={field}
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={1024}
                    autoFocus={field === "password"}
                    placeholder={
                      field === "password"
                        ? "At least 12 characters"
                        : "Repeat password"
                    }
                    value={values[field]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      setTouched((current) => ({ ...current, [field]: true }))
                    }
                    aria-invalid={Boolean(message)}
                    aria-describedby={message ? `${field}-error` : undefined}
                  />
                  <button
                    type="button"
                    className={cn(
                      "absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-[#7183a2] hover:text-[#32549a]",
                      accountFocusRing,
                    )}
                    aria-label={`${visible ? "Hide" : "Show"} ${field === "password" ? "new password" : "confirmation password"}`}
                    aria-pressed={visible}
                    onClick={() =>
                      field === "password"
                        ? setShowPassword((current) => !current)
                        : setShowConfirmation((current) => !current)
                    }
                  >
                    <EyeIcon off={visible} />
                  </button>
                </div>
                <p
                  id={`${field}-error`}
                  className="m-0 min-h-[16px] text-[11px] font-normal text-[#bc3649]"
                  aria-live="polite"
                >
                  {message}
                </p>
              </label>
            )
          })}
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
            aria-busy={saving}
          >
            {saving ? "Resetting…" : "Reset password"}
          </button>
        </div>
      </form>
    </dialog>
  )
}
