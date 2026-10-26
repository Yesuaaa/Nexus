import type { EmploymentType } from "../api/employees-api"

export type EmployeeDraft = {
  employeeId: string
  fullName: string
  email: string
  contactNumber: string
  position: string
  employmentType: EmploymentType
  startDate: string
  departmentId: string
  teamId: string
}

export type EmployeeField =
  | "employeeId"
  | "fullName"
  | "email"
  | "contactNumber"
  | "position"
  | "startDate"

export type EmployeeFieldErrors = Partial<Record<EmployeeField, string>>
export type EmployeeTouched = Partial<Record<EmployeeField, boolean>>

const NAME_RE = /^\p{L}[\p{L} .'’-]*$/u
const EMAIL_RE =
  /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|ph)$/i
const PHONE_RE = /^0[89]\d{9}$/
const EMPLOYEE_ID_RE = /^[A-Za-z0-9_-]+$/

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
    errors.employeeId = "Use letters, numbers, hyphens, or underscores only."

  if (!fullName) errors.fullName = "Full name is required."
  else if (fullName.length < 2 || fullName.length > 100)
    errors.fullName = "Full name must be between 2 and 100 characters."
  else if (!NAME_RE.test(fullName))
    errors.fullName = "Letters, spaces, hyphens, apostrophes and periods only."

  if (email && (email.length > 254 || !EMAIL_RE.test(email)))
    errors.email = "Enter a valid .com or .ph email address."

  if (contactNumber && !PHONE_RE.test(contactNumber))
    errors.contactNumber = "Enter 11 digits starting with 09 or 08."

  if (position.length > 100)
    errors.position = "Position must be 100 characters or fewer."

  if (draft.startDate && !isValidDate(draft.startDate))
    errors.startDate = "Enter a valid start date."

  return errors
}

export function visibleEmployeeError(
  field: EmployeeField,
  value: string,
  errors: EmployeeFieldErrors,
  touched: EmployeeTouched,
  submitted: boolean,
) {
  return value.length > 0 || touched[field] || submitted
    ? errors[field]
    : undefined
}
