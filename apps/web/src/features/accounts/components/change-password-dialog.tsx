"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"
import { sileo } from "sileo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, clearToken } from "@/features/auth/api/auth-api"
import type { Account } from "@/features/auth/model/types"
import { changeAccountPassword } from "../api/accounts-api"
import { cn } from "@/lib/utils"
import {
  accountButton,
  accountButtonPrimary,
  accountButtonSecondary,
  accountField,
  accountFocusRing,
  accountInput,
} from "../styles/account-styles"

const fields = [
  { name: "newPassword", label: "New password" },
  { name: "confirmation", label: "Confirm new password" },
] as const

type Field = (typeof fields)[number]["name"]
type Values = Record<Field, string>

export function ChangePasswordDialog({
  account,
  onClose,
}: {
  account: Account
  onClose: () => void
}) {
  const router = useRouter()
  const [values, setValues] = useState<Values>({
    newPassword: "",
    confirmation: "",
  })
  const [visible, setVisible] = useState<Partial<Record<Field, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const errorToast = useRef<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingRef.current) return
    const form = event.currentTarget
    const nextErrors: Partial<Record<Field, string>> = {}
    const encoder = new TextEncoder()
    if (values.newPassword.length < 12)
      nextErrors.newPassword = "Use at least 12 characters."
    else if (encoder.encode(values.newPassword).length > 1024)
      nextErrors.newPassword = "Use no more than 1,024 bytes."
    else if (
      !/[A-Z]/.test(values.newPassword) ||
      !/[a-z]/.test(values.newPassword) ||
      !/[0-9]/.test(values.newPassword) ||
      !/[^A-Za-z0-9]/.test(values.newPassword)
    )
      nextErrors.newPassword =
        "Include uppercase, lowercase, a number and a special character."
    if (!values.confirmation)
      nextErrors.confirmation = "Confirm your new password."
    else if (values.newPassword !== values.confirmation)
      nextErrors.confirmation = "Passwords do not match."
    setErrors(nextErrors)
    setError("")
    if (errorToast.current) {
      sileo.dismiss(errorToast.current)
      errorToast.current = null
    }
    const invalidField = fields.find(({ name }) => nextErrors[name])
    if (invalidField) {
      form
        .querySelector<HTMLInputElement>(`[name="${invalidField.name}"]`)
        ?.focus()
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      await changeAccountPassword(account.id, values.newPassword)
      setValues({ newPassword: "", confirmation: "" })
      sileo.success({
        title: "Password changed",
        description: `The password for ${account.email} has been changed. Their active sessions have been signed out.`,
      })
      onClose()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearToken()
        router.replace("/login")
        return
      }
      const message =
        caught instanceof ApiError
          ? caught.message
          : "Couldn't change the account password. Please try again."
      setError(message)
      errorToast.current = sileo.error({
        title: "Couldn't change password",
        description: message,
      })
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !savingRef.current && onClose()}
    >
      <DialogContent
        className="max-h-[calc(100dvh_-_32px)] w-[calc(100%_-_32px)] overflow-y-auto rounded-xl bg-background p-6 text-foreground sm:rounded-xl"
        overlayClassName="bg-black/40"
        showCloseButton={!saving}
        onEscapeKeyDown={(event) => savingRef.current && event.preventDefault()}
        onInteractOutside={(event) =>
          savingRef.current && event.preventDefault()
        }
      >
        <DialogHeader>
          <DialogTitle>Change account password</DialogTitle>
          <DialogDescription className="break-words">
            Set a new password for {account.email}. This account will be signed
            out on all devices after saving. Its current password is not
            required.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void handleSubmit(event)}
          aria-busy={saving}
        >
          <fieldset
            disabled={saving}
            className="m-0 grid min-w-0 gap-4 border-0 p-0"
          >
            {fields.map(({ name, label }) => (
              <div key={name} className={accountField}>
                <label
                  htmlFor={`change-${name}`}
                  className="text-xs font-semibold"
                >
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={`change-${name}`}
                    name={name}
                    type={visible[name] ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={values[name]}
                    onChange={(event) => {
                      setValues((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                      setErrors((current) => ({
                        ...current,
                        [name]: undefined,
                      }))
                      setError("")
                    }}
                    aria-invalid={Boolean(errors[name])}
                    aria-describedby={
                      [
                        name === "newPassword" && "change-password-hint",
                        errors[name] && `change-${name}-error`,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                    className={cn(
                      accountInput,
                      "pr-11",
                      errors[name] && "border-[#d64557]",
                    )}
                  />
                  <button
                    type="button"
                    aria-label={`${visible[name] ? "Hide" : "Show"} ${label.toLowerCase()}`}
                    aria-pressed={Boolean(visible[name])}
                    onClick={() =>
                      setVisible((current) => ({
                        ...current,
                        [name]: !current[name],
                      }))
                    }
                    className={cn(
                      "absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-[#738096]",
                      accountFocusRing,
                    )}
                  >
                    {visible[name] ? (
                      <EyeOff size={17} aria-hidden="true" />
                    ) : (
                      <Eye size={17} aria-hidden="true" />
                    )}
                  </button>
                </div>
                {name === "newPassword" && (
                  <p
                    id="change-password-hint"
                    className="m-0 text-xs text-[#738096]"
                  >
                    Use at least 12 characters with uppercase, lowercase, a
                    number and a special character, up to 1,024 bytes.
                  </p>
                )}
                {errors[name] && (
                  <p
                    id={`change-${name}-error`}
                    className="m-0 text-xs text-[#bc3649]"
                  >
                    {errors[name]}
                  </p>
                )}
              </div>
            ))}
            {error && (
              <p
                role="alert"
                className="m-0 rounded-lg bg-[#fff0f1] p-3 text-xs text-[#bc3649]"
              >
                {error}
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={cn(accountButton, accountButtonSecondary, "text-xs")}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(accountButton, accountButtonPrimary, "text-xs")}
              >
                {saving && (
                  <LoaderCircle
                    size={14}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {saving ? "Changing password…" : "Change password"}
              </button>
            </div>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
