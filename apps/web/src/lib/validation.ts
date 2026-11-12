/**
 * Shared input rules for the web app's forms. Each form keeps its own
 * message wording; the rules themselves live here so they stay identical.
 *
 * Imported by modules that run under `node --test`, so this file must not
 * use the `@/` path alias.
 */

/** Letters (any script), spaces, periods, apostrophes, and hyphens. */
export const NAME_PATTERN = /^\p{L}[\p{L} .'’-]*$/u

/** A conventional address with any domain, e.g. name@example.org. */
export const EMAIL_PATTERN =
  /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/

export const EMAIL_MAX_LENGTH = 254

/** Generic contact number: optional +, then 7–20 digits, spaces, or hyphens. */
export const CONTACT_PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,19}$/

/** Philippine mobile number: 11 digits starting with 09 or 08. */
export const PH_MOBILE_PATTERN = /^0[89]\d{9}$/

export function isValidEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value)
}

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_BYTES = 1024

export type PasswordIssueCode =
  "short" | "long" | "uppercase" | "lowercase" | "number" | "special"

export const passwordIssueMessages: Record<PasswordIssueCode, string> = {
  short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  long: "Password is too long.",
  uppercase: "Include at least one capital letter.",
  lowercase: "Include at least one lowercase letter.",
  number: "Include at least one number.",
  special: "Include at least one special character.",
}

/** One-line summary of the password policy, for hints under a field. */
export const passwordPolicyHint = `Use at least ${PASSWORD_MIN_LENGTH} characters with uppercase and lowercase letters, a number, and a special character.`

/** The first rule a new password breaks, or null when it meets the policy. */
export function passwordIssueCode(password: string): PasswordIssueCode | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "short"
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)
    return "long"
  if (!/[A-Z]/.test(password)) return "uppercase"
  if (!/[a-z]/.test(password)) return "lowercase"
  if (!/[0-9]/.test(password)) return "number"
  if (!/[^A-Za-z0-9]/.test(password)) return "special"
  return null
}

/**
 * Message for the first rule a new password breaks, or null when it meets
 * the policy. Pass `messages` to use a form's own wording.
 */
export function passwordIssue(
  password: string,
  messages: Record<PasswordIssueCode, string> = passwordIssueMessages,
): string | null {
  const code = passwordIssueCode(password)
  return code ? messages[code] : null
}
