import type { AuthCopy } from "../content/auth-copy"
import type { AuthMode } from "./types"

export type Field =
  "fullName" | "contactNumber" | "email" | "password" | "confirmPassword"
export type AuthFormValues = Record<Field, string>
type FieldErrors = Partial<Record<Field, string>>

export const fieldIds: Record<Field, string> = {
  fullName: "full-name",
  contactNumber: "contact-number",
  email: "email",
  password: "password",
  confirmPassword: "confirm-password",
}

type FieldInteraction =
  | { type: "focus"; field: Field }
  | { type: "blur"; field: Field; invalid: boolean }

export function visibleFieldAfterInteraction(
  current: Field | null,
  interaction: FieldInteraction,
): Field | null {
  if (interaction.type === "focus") return current
  if (interaction.invalid) return interaction.field
  return current === interaction.field ? null : current
}

export function validateAuth(
  mode: AuthMode,
  values: AuthFormValues,
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
