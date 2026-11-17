import { fail } from "../../shared/http-error.js"
import { isPlainObject, isUuidV4 } from "../../shared/validation.js"

export const leaveTypes = [
  "ANNUAL",
  "SICK",
  "EMERGENCY",
  "UNPAID",
  "OTHER",
] as const

export const leaveStatuses = [
  "SUBMITTED",
  "VERIFIED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "REVERSED",
] as const

export type LeaveTypeInput = (typeof leaveTypes)[number]
export type LeaveStatusInput = (typeof leaveStatuses)[number]

export function leaveObject(input: unknown, keys: readonly string[]) {
  if (
    !isPlainObject(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    fail(400, "Invalid leave request fields")
  return input
}

export function leaveText(value: unknown, label: string, min = 5, max = 2000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `Provide a valid ${label}`)
  return value.trim()
}

export function leaveUuid(value: unknown, label: string) {
  if (!isUuidV4(value)) fail(400, `Provide a UUID ${label}`)
  return value
}

export function leaveDate(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(400, `Provide a valid ${label} date`)
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    fail(400, `Provide a valid ${label} date`)
  return date
}

export function leaveRange(startValue: unknown, endValue: unknown) {
  const startDate = leaveDate(startValue, "start")
  const endDate = leaveDate(endValue, "end")
  const days =
    Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  if (days < 1 || days > 366)
    fail(400, "Leave must cover between 1 and 366 inclusive dates")
  return { startDate, endDate, days }
}

export function leaveType(value: unknown): LeaveTypeInput {
  if (!leaveTypes.includes(value as LeaveTypeInput))
    fail(400, "Choose a valid leave type")
  return value as LeaveTypeInput
}

export function leaveStatus(value: unknown): LeaveStatusInput | undefined {
  if (value === undefined || value === "") return undefined
  if (!leaveStatuses.includes(value as LeaveStatusInput))
    fail(400, "Choose a valid leave status")
  return value as LeaveStatusInput
}

export function expectedLeaveVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    fail(400, "Provide the current request version")
  return value
}
