/**
 * The one policy for every password a person sets (registration, self-service
 * change, account management, admin reset, employee and client accounts).
 * Login and current-password checks only enforce the byte cap so that
 * passwords stored before this policy keep working.
 */

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_BYTES = 1024
export const PASSWORD_POLICY_MESSAGE =
  "Use at least 12 characters, including uppercase, lowercase, a number and a special character, up to 1,024 bytes"

/** Size guard for passwords that are only verified, never stored. */
export function withinPasswordByteLimit(value: string): boolean {
  return Buffer.byteLength(value) <= PASSWORD_MAX_BYTES
}

/** Why a new password is unacceptable, or null when it meets the policy. */
export function passwordIssue(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN_LENGTH ||
    !withinPasswordByteLimit(value) ||
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  )
    return PASSWORD_POLICY_MESSAGE
  return null
}

export function isStrongPassword(value: unknown): value is string {
  return passwordIssue(value) === null
}

/** Throws `toError(message)` unless the value meets the password policy. */
export function assertStrongPassword(
  value: unknown,
  toError: (message: string) => Error,
): asserts value is string {
  const issue = passwordIssue(value)
  if (issue) throw toError(issue)
}
