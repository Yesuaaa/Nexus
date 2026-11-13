/**
 * Shared request-input predicates and normalizers.
 * Feature modules keep their own error types/messages; these helpers only
 * answer "is this value acceptable?" so the rules stay identical everywhere.
 */
import type { RequestParamHandler } from "express"

const recordIdPattern = /^[A-Za-z0-9_-]{1,80}$/
const uuidV4Pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Database record IDs (cuid/uuid/slug-like): 1–80 URL-safe characters. */
export function isRecordId(value: unknown): value is string {
  return typeof value === "string" && recordIdPattern.test(value)
}

/** Client-generated idempotency keys (RFC 4122 version 4 UUIDs). */
export function isUuidV4(value: unknown): value is string {
  return typeof value === "string" && uuidV4Pattern.test(value)
}

/** Optional cursor/query value: absent, or a valid record ID. */
export function isOptionalRecordId(
  value: unknown,
): value is string | undefined {
  return value === undefined || isRecordId(value)
}

/** `router.param()` handler rejecting malformed record IDs with a 400. */
export function recordIdParam(error: string): RequestParamHandler {
  return (_request, response, next, value: string) => {
    if (!isRecordId(value)) {
      response.status(400).json({ error })
      return
    }
    next()
  }
}

export const MESSAGE_BODY_MAX_LENGTH = 4000

/** Chat message text: non-blank, at most 4,000 characters, no NUL bytes. */
export function isMessageBody(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Boolean(value.trim()) &&
    value.length <= MESSAGE_BODY_MAX_LENGTH &&
    !value.includes("\u0000")
  )
}

/** A JSON object body (not null, not an array). */
export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** Trimmed, lower-cased email with a dotted domain, or undefined. */
export function normalizedEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return undefined
  return email
}

/** Generic contact number (registration, clients, accounts, profile). */
export const contactNumberPattern = /^\+?[0-9][0-9\s-]{6,19}$/
/** Employee records: 11-digit PH mobile number starting with 09 or 08. */
export const employeeMobileNumberPattern = /^0[89]\d{9}$/

export function isContactNumber(value: string): boolean {
  return contactNumberPattern.test(value)
}

export function isEmployeeMobileNumber(value: string): boolean {
  return employeeMobileNumberPattern.test(value)
}

/** Normalized `https:` URL without embedded credentials, or null. */
export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}
