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

const emailPattern =
  /^[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(com|ph)$/iu

function validRegistrationEmail(email: string): boolean {
  const normalized = email.normalize("NFC").toLowerCase().normalize("NFC")
  if (normalized.length > 254 || !emailPattern.test(normalized)) return false
  const [local, domain, extra] = normalized.split("@")
  if (!local || local.length > 64 || !domain || extra !== undefined)
    return false

  try {
    const parsedDomain = new URL(`http://${domain}`)
    if (
      parsedDomain.username ||
      parsedDomain.password ||
      parsedDomain.port ||
      parsedDomain.pathname !== "/" ||
      parsedDomain.search ||
      parsedDomain.hash
    )
      return false
    const asciiEmail = `${local}@${parsedDomain.hostname}`
    return parsedDomain.hostname.length <= 253 && emailPattern.test(asciiEmail)
  } catch {
    return false
  }
}

export function validateAuth(
  mode: AuthMode,
  values: AuthFormValues,
  copy: AuthCopy,
): FieldErrors {
  const errors: FieldErrors = {}
  const fields =
    values && typeof values === "object" && !Array.isArray(values)
      ? (values as Partial<Record<Field, unknown>>)
      : {}
  const fullName = typeof fields.fullName === "string" ? fields.fullName : ""
  const contactNumber =
    typeof fields.contactNumber === "string" ? fields.contactNumber : ""
  const emailValue = typeof fields.email === "string" ? fields.email : ""
  const password = typeof fields.password === "string" ? fields.password : ""
  const confirmPassword =
    typeof fields.confirmPassword === "string" ? fields.confirmPassword : ""
  const email = emailValue.trim()

  if (mode === "register") {
    const name = fullName.trim().normalize("NFC")
    const contact = contactNumber.trim()
    if (!name) errors.fullName = copy.nameRequired
    else if (name.length < 2 || name.length > 100)
      errors.fullName = copy.nameLength
    else if (!/^\p{L}[\p{L}\p{M} .\u2019'-]*$/u.test(name))
      errors.fullName = copy.nameInvalid

    if (!contact) errors.contactNumber = copy.contactRequired
    else if (!/^0[89]\d{9}$/.test(contact))
      errors.contactNumber = copy.contactInvalid
  }

  if (!email) errors.email = copy.emailRequired
  else if (
    mode === "register"
      ? !validRegistrationEmail(email)
      : email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    errors.email = copy.emailInvalid

  if (!password) errors.password = copy.passwordRequired
  else if (mode === "register" && password.length < 12)
    errors.password = copy.passwordShort
  else if (new TextEncoder().encode(password).length > 1024)
    errors.password = copy.passwordLong
  else if (mode === "register" && !/\p{Lu}/u.test(password))
    errors.password = copy.passwordCapital
  else if (mode === "register" && !/\p{Ll}/u.test(password))
    errors.password = copy.passwordLowercase
  else if (mode === "register" && !/\p{Nd}/u.test(password))
    errors.password = copy.passwordNumber
  else if (mode === "register" && !/[^\p{L}\p{M}\p{N}]/u.test(password))
    errors.password = copy.passwordSpecial

  if (mode === "register") {
    if (!confirmPassword) errors.confirmPassword = copy.confirmRequired
    else if (confirmPassword !== password)
      errors.confirmPassword = copy.passwordMismatch
  }

  return errors
}
