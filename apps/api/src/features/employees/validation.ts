import {
  EmploymentType,
  EmployeeStatus,
} from "../../generated/prisma/client.js"

const NAME_RE = /^\p{L}[\p{L} .'’-]*$/u
const EMAIL_RE =
  /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|ph)$/i
const PHONE_RE = /^0[89]\d{9}$/

export type EmployeeInput = {
  employeeId?: string
  fullName?: string
  email?: string | null
  contactNumber?: string | null
  position?: string | null
  employmentType?: EmploymentType
  status?: EmployeeStatus
  startDate?: Date | null
  departmentId?: string | null
  teamId?: string | null
  replacementHeadEmployeeId?: string
}

const requiredAssignmentFields = [
  "startDate",
  "departmentId",
  "teamId",
] as const

export function validateEmployeeInput(
  input: unknown,
  partial: boolean,
): { value: EmployeeInput } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide a valid employee record" }
  }

  const body = input as Record<string, unknown>
  if (Object.prototype.hasOwnProperty.call(body, "userId")) {
    return {
      error: "Account associations are managed outside Employee Management",
    }
  }
  const value: EmployeeInput = {}

  if (body.employeeId !== undefined || !partial) {
    if (
      typeof body.employeeId !== "string" ||
      body.employeeId.trim().length < 2 ||
      body.employeeId.trim().length > 40 ||
      !/^[A-Za-z0-9_-]+$/.test(body.employeeId.trim())
    ) {
      return {
        error:
          "Employee ID must be 2 to 40 characters using letters, numbers, underscores, or hyphens",
      }
    }
    value.employeeId = body.employeeId.trim()
  }

  if (body.fullName !== undefined || !partial) {
    if (
      typeof body.fullName !== "string" ||
      body.fullName.trim().length < 2 ||
      body.fullName.trim().length > 100 ||
      !NAME_RE.test(body.fullName.trim())
    ) {
      return {
        error:
          "Full name must be 2 to 100 characters using letters, spaces, hyphens, apostrophes, or periods",
      }
    }
    value.fullName = body.fullName.trim()
  }

  if (body.email !== undefined || !partial) {
    if (typeof body.email !== "string" || !body.email.trim()) {
      return { error: "Email is required" }
    } else if (
      body.email.trim().length > 254 ||
      !EMAIL_RE.test(body.email.trim())
    ) {
      return { error: "Provide a valid email address" }
    } else value.email = body.email.trim().toLowerCase()
  }

  if (body.contactNumber !== undefined || !partial) {
    if (typeof body.contactNumber !== "string" || !body.contactNumber.trim()) {
      return { error: "Contact number is required" }
    } else if (!PHONE_RE.test(body.contactNumber.trim())) {
      return { error: "Provide 11 digits starting with 09 or 08" }
    } else value.contactNumber = body.contactNumber.trim()
  }

  if (body.position !== undefined || !partial) {
    if (typeof body.position !== "string" || !body.position.trim()) {
      return { error: "Position is required" }
    } else if (body.position.trim().length > 100) {
      return { error: "Position must be 100 characters or fewer" }
    } else value.position = body.position.trim()
  }

  if (body.employmentType !== undefined || !partial) {
    if (
      typeof body.employmentType !== "string" ||
      !Object.values(EmploymentType).includes(
        body.employmentType as EmploymentType,
      )
    ) {
      return { error: "Invalid employment type" }
    }
    value.employmentType = body.employmentType as EmploymentType
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !Object.values(EmployeeStatus).includes(body.status as EmployeeStatus)
    ) {
      return { error: "Invalid employment status" }
    }
    value.status = body.status as EmployeeStatus
  }

  if (body.replacementHeadEmployeeId !== undefined) {
    if (
      typeof body.replacementHeadEmployeeId !== "string" ||
      !body.replacementHeadEmployeeId.trim() ||
      body.replacementHeadEmployeeId.trim().length > 80
    ) {
      return { error: "Provide a valid temporary Department Head" }
    }
    value.replacementHeadEmployeeId = body.replacementHeadEmployeeId.trim()
  }

  for (const field of requiredAssignmentFields) {
    if (body[field] === undefined) {
      if (!partial) {
        return {
          error:
            field === "startDate"
              ? "Start date is required"
              : field === "departmentId"
                ? "Select a department"
                : "Choose a team or No team",
        }
      }
      continue
    }
    if (field === "teamId" && body.teamId === null) {
      value.teamId = null
      continue
    }
    if (body[field] === null || body[field] === "") {
      return {
        error:
          field === "startDate"
            ? "Start date is required"
            : field === "departmentId"
              ? "Select a department"
              : "Choose a team or No team",
      }
    }

    if (field === "startDate") {
      if (typeof body.startDate !== "string") {
        return { error: "Provide a valid start date" }
      }
      const parsed = new Date(body.startDate)
      if (
        Number.isNaN(parsed.getTime()) ||
        !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(body.startDate) ||
        parsed.toISOString().slice(0, 10) !== body.startDate.slice(0, 10)
      ) {
        return { error: "Provide a valid start date" }
      }
      value.startDate = parsed
      continue
    }

    if (field === "departmentId" || field === "teamId") {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return { error: `Provide a valid ${field}` }
      }
      value[field] = body[field].trim()
    }
  }

  return { value }
}
