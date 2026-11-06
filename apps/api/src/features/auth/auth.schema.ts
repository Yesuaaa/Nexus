import { domainToASCII } from "node:url"

const emailPattern =
  /^[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{M}\p{N}!#$%&'*+/=?^_`{|}~-]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(com|ph)$/iu

const fullNamePattern = /^\p{L}[\p{L}\p{M} .\u2019'-]*$/u

export function normalizedEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFC")
  const separator = normalized.lastIndexOf("@")
  const domain =
    separator > 0 ? domainToASCII(normalized.slice(separator + 1)) : ""
  const email = domain
    ? `${normalized.slice(0, separator)}@${domain.toLowerCase()}`
    : normalized
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return undefined
  return email
}

export function registrationEmail(value: unknown): string | undefined {
  const email = normalizedEmail(value)
  if (!email) return undefined
  const [local, domain] = email.split("@")
  if (
    !local ||
    local.length > 64 ||
    !/[\p{L}\p{N}]/u.test(local) ||
    !domain ||
    domain.length > 253 ||
    !emailPattern.test(email)
  )
    return undefined
  return email
}

export function validRegistrationProfile(
  fullName: unknown,
  contactNumber: unknown,
): fullName is string {
  if (typeof fullName !== "string" || typeof contactNumber !== "string")
    return false
  const name = fullName.trim().normalize("NFC")
  return (
    name.length >= 2 &&
    name.length <= 100 &&
    fullNamePattern.test(name) &&
    /^0[89]\d{9}$/.test(contactNumber.trim())
  )
}
