import { HttpError } from "../../shared/http-error.js"
import {
  isPlainObject,
  isRecordId,
  isUuidV4,
  isContactNumber,
  normalizedEmail,
} from "../../shared/validation.js"

export const inquiryStatuses = [
  "PENDING",
  "CONTACTED",
  "CLOSED",
  "SPAM",
] as const
export type InquiryStatus = (typeof inquiryStatuses)[number]

export function statusInput(value: unknown): InquiryStatus {
  if (!inquiryStatuses.some((status) => status === value))
    throw new HttpError(400, "Choose a valid inquiry status.")
  return value as InquiryStatus
}

export function pageInput(value: unknown): number {
  if (value === undefined) return 1
  if (typeof value !== "string" || !/^[1-9][0-9]{0,4}$/.test(value))
    throw new HttpError(400, "Invalid page.")
  return Number(value)
}

export function searchInput(value: unknown): string {
  if (value === undefined) return ""
  if (typeof value !== "string" || value.length > 120)
    throw new HttpError(400, "Search must be 120 characters or fewer.")
  return value.trim()
}

export function idInput(value: unknown): string {
  if (!isRecordId(value)) throw new HttpError(400, "Invalid record ID.")
  return value
}

function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string")
    throw new HttpError(400, label + " is required.")
  const result = value.trim()
  if (
    result.length < min ||
    result.length > max ||
    Array.from(result).some((character) => {
      const code = character.charCodeAt(0)
      return (
        (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127
      )
    })
  )
    throw new HttpError(
      400,
      label + " must be " + min + "–" + max + " characters.",
    )
  return result
}

export function validateInquiry(body: unknown) {
  if (!isPlainObject(body)) throw new HttpError(400, "Invalid inquiry.")
  if (body.website !== "")
    throw new HttpError(400, "Unable to submit this inquiry.")
  if (body.agreed !== true)
    throw new HttpError(
      400,
      "Please acknowledge that an inquiry is not a booking.",
    )
  const email = normalizedEmail(body.email)
  if (!email) throw new HttpError(400, "Enter a valid email address.")
  const contactNumber = text(body.contactNumber, "Contact number", 7, 24)
  if (!isContactNumber(contactNumber))
    throw new HttpError(400, "Enter a valid contact number.")
  if (!isUuidV4(body.submissionKey))
    throw new HttpError(
      400,
      "Invalid submission key. Refresh the page and try again.",
    )
  return {
    fullName: text(body.fullName, "Full name", 2, 100),
    email,
    contactNumber,
    subject: text(body.subject, "Subject", 3, 160),
    message: text(body.message, "Message", 10, 6000),
    submissionKey: body.submissionKey,
  }
}

export function validateReview(body: unknown) {
  if (!isPlainObject(body)) throw new HttpError(400, "Invalid review.")
  if (
    typeof body.version !== "number" ||
    !Number.isSafeInteger(body.version) ||
    body.version < 0
  )
    throw new HttpError(400, "Invalid review version.")
  const status = statusInput(body.status)
  const internalNote =
    body.internalNote === "" || body.internalNote === null
      ? null
      : text(body.internalNote, "Internal note", 1, 2000)
  return { status, internalNote, version: body.version }
}
