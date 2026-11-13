import type { EmploymentType } from "../api/employees-api"
import {
  NAME_PATTERN,
  PH_MOBILE_PATTERN,
  isValidEmail,
  passwordIssue,
} from "../../../lib/validation.ts"

export type EmployeeDraft = {
  employeeId: string
  fullName: string
  email: string
  contactNumber: string
  position: string
  employmentType: EmploymentType | ""
  startDate: string
  departmentId: string
  teamId: string
  password: string
  passwordConfirmation: string
}

export type EmployeeField =
  | "employeeId"
  | "fullName"
  | "email"
  | "contactNumber"
  | "position"
  | "employmentType"
  | "startDate"
  | "departmentId"
  | "teamId"
  | "password"
  | "passwordConfirmation"

export type EmployeeFieldErrors = Partial<Record<EmployeeField, string>>

type EmployeeFieldInteraction =
  | { type: "focus"; field: EmployeeField }
  | { type: "blur"; field: EmployeeField; invalid: boolean }

const EMPLOYEE_ID_RE = /^EXP-[A-Za-z0-9_-]+$/

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export function validateEmployeeDraft(
  draft: EmployeeDraft,
  requireAccountCredentials = true,
): EmployeeFieldErrors {
  const errors: EmployeeFieldErrors = {}
  const employeeId = draft.employeeId.trim()
  const fullName = draft.fullName.trim()
  const email = draft.email.trim()
  const contactNumber = draft.contactNumber.trim()
  const position = draft.position.trim()

  if (!employeeId) errors.employeeId = "Employee ID is required."
  else if (employeeId.length < 2 || employeeId.length > 40)
    errors.employeeId = "Employee ID must be between 2 and 40 characters."
  else if (!EMPLOYEE_ID_RE.test(employeeId))
    errors.employeeId =
      "Use EXP- followed by letters, numbers, hyphens, or underscores."

  if (!fullName) errors.fullName = "Full name is required."
  else if (fullName.length < 2 || fullName.length > 100)
    errors.fullName = "Full name must be between 2 and 100 characters."
  else if (!NAME_PATTERN.test(fullName))
    errors.fullName = "Letters, spaces, hyphens, apostrophes and periods only."

  if (!email) errors.email = "Email is required."
  else if (!isValidEmail(email)) errors.email = "Enter a valid email address."

  if (!contactNumber) errors.contactNumber = "Contact number is required."
  else if (!PH_MOBILE_PATTERN.test(contactNumber))
    errors.contactNumber = "Enter 11 digits starting with 09 or 08."

  if (!position) errors.position = "Position is required."
  else if (position.length > 100)
    errors.position = "Position must be 100 characters or fewer."

  if (!draft.employmentType)
    errors.employmentType = "Select an employment type."

  if (!draft.startDate) errors.startDate = "Start date is required."
  else if (!isValidDate(draft.startDate))
    errors.startDate = "Enter a valid start date."

  if (!draft.departmentId) errors.departmentId = "Select a department."

  if (!draft.teamId) errors.teamId = "Select a team or No team."

  if (requireAccountCredentials) {
    const passwordError = draft.password
      ? passwordIssue(draft.password)
      : "Password is required."
    if (passwordError) errors.password = passwordError

    if (!draft.passwordConfirmation)
      errors.passwordConfirmation = "Please confirm the password."
    else if (draft.password !== draft.passwordConfirmation)
      errors.passwordConfirmation = "Passwords do not match."
  }

  return errors
}

export function visibleEmployeeError(
  field: EmployeeField,
  visibleField: EmployeeField | null,
  errors: EmployeeFieldErrors,
) {
  return visibleField === field ? errors[field] : undefined
}

export function employeeFieldAfterInteraction(
  current: EmployeeField | null,
  interaction: EmployeeFieldInteraction,
): EmployeeField | null {
  if (interaction.type === "focus") return current
  if (interaction.invalid) return interaction.field
  return current === interaction.field ? null : current
}
