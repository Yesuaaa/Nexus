"use client"
import { useState, type FormEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@/components/ui/button"
import { focusRing } from "@/components/layout/styles"
import { clearToken } from "@/features/auth/api/auth-api"
import { changeProfilePassword } from "@/features/profile/api/profile-api"
const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-[#d8e1ef] bg-background px-3 py-2 text-sm text-[#182235] outline-none focus-visible:ring-2 focus-visible:ring-[#294a9b] disabled:opacity-60"
const primaryClass =
  "min-h-11 bg-[#203f8c] text-xs text-white hover:bg-[#172f70]"
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
    <label className="grid min-w-0 content-start gap-2 text-xs font-medium text-[#52627a]">
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
    <p role="alert" className="m-0 text-xs leading-5 text-[#bc3649]">
      {message}
    </p>
  ) : null
}
function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "Your changes could not be saved. Try again."
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
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={1024}
          required
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className={`absolute top-0 right-0 grid size-11 cursor-pointer place-items-center rounded-lg text-[#667b9e] ${focusRing}`}
        >
          {visible ? (
            <EyeOff size={17} aria-hidden="true" />
          ) : (
            <Eye size={17} aria-hidden="true" />
          )}
        </button>
      </div>
    </Field>
  )
}
export function SecurityDetails({
  onBusyChange,
}: { onBusyChange?: (busy: boolean) => void } = {}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("The new passwords do not match.")
      return
    }
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      await changeProfilePassword(
        String(data.get("currentPassword")),
        String(data.get("newPassword")),
      )
      clearToken()
      sileo.success({
        title: "Password changed",
        description: "Sign in with your new password.",
      })
      router.replace("/login")
    } catch (reason) {
      setError(errorText(reason))
      setBusy(false)
    } finally {
      onBusyChange?.(false)
    }
  }
  return (
    <Section
      id="security"
      title="Password & security"
      description="Use at least 12 characters. Changing your password signs out all active sessions."
    >
      <form onSubmit={save} className="grid gap-5">
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
              minLength={12}
            />
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={12}
            />
          </div>
        </fieldset>
        <ErrorMessage message={error} />
        <div className="flex justify-end border-t border-[#eceef1] pt-4">
          <Button className={primaryClass} disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </div>
      </form>
    </Section>
  )
}
