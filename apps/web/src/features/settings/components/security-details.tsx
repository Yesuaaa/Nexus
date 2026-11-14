"use client"

import { Form } from "@/components/ui/form"
import { formFieldClass } from "@/components/ui/form-control-styles"
import { useState, type FormEvent, type ReactNode } from "react"
import { sileo } from "@/lib/toast"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import { changeProfilePassword } from "@/features/profile/api/profile-api"
import { errorMessage } from "@/lib/error-message"
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordIssue,
  passwordPolicyHint,
} from "@/lib/validation"
function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className={`${formFieldClass} content-start`}>
      {label}
      {children}
      {hint && (
        <span className="text-[11px] font-normal leading-5 text-[#738096]">
          {hint}
        </span>
      )}
    </label>
  )
}
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 rounded-xl border border-[#e1e6ee] bg-background p-5 sm:p-6"
    >
      <header className="mb-6 pr-8">
        <h2 className="m-0 text-base font-semibold text-[#182235]">{title}</h2>
        <p className="mt-2 mb-0 text-xs leading-5 text-[#738096]">
          {description}
        </p>
      </header>
      {children}
    </section>
  )
}
function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <Alert variant="text" className="leading-5">
      {message}
    </Alert>
  ) : null
}

function PasswordField({
  label,
  name,
  autoComplete,
  minLength,
}: {
  label: string
  name: string
  autoComplete: string
  minLength?: number
}) {
  return (
    <Field label={label}>
      <PasswordInput
        name={name}
        toggleLabel={label.toLowerCase()}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={PASSWORD_MAX_BYTES}
        required
      />
    </Field>
  )
}
export function SecurityDetails({
  onBusyChange,
  onChanged,
}: {
  onBusyChange?: (busy: boolean) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const newPassword = String(data.get("newPassword"))
    if (newPassword !== data.get("confirmPassword")) {
      setError("The new passwords do not match.")
      return
    }
    const passwordError = passwordIssue(newPassword)
    if (passwordError) {
      setError(passwordError)
      return
    }
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      await changeProfilePassword(
        String(data.get("currentPassword")),
        newPassword,
      )
      sileo.success({ title: "Password changed" })
      onChanged()
    } catch (reason) {
      setError(
        errorMessage(reason, "Your changes could not be saved. Try again."),
      )
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }
  return (
    <Section
      id="security"
      title="Password & security"
      description={`${passwordPolicyHint} After saving, you can choose whether to log out of all devices.`}
    >
      <Form onSubmit={save} className="grid gap-5">
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-5 border-0 p-0"
        >
          <PasswordField
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <PasswordField
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>
        </fieldset>
        <ErrorMessage message={error} />
        <div className="flex justify-end border-t border-[#eceef1] pt-4">
          <Button variant="brand" size="touch" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </Form>
    </Section>
  )
}
