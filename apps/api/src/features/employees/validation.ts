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
  userId?: string | null
}

const optionalNullableFields = [
  "email",
  "contactNumber",
  "position",
  "startDate",
  "departmentId",
  "teamId",
  "userId",
] as const

export function validateEmployeeInput(
  input: unknown,
  partial: boolean,
): { value: EmployeeInput } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide a valid employee record" }
  }

  const body = input as Record<string, unknown>
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

  if (body.email !== undefined) {
    if (body.email === null || body.email === "") value.email = null
    else if (
      typeof body.email !== "string" ||
      body.email.trim().length > 254 ||
      !EMAIL_RE.test(body.email.trim())
    ) {
      return { error: "Provide a valid email address" }
    } else value.email = body.email.trim().toLowerCase()
  }

  if (body.contactNumber !== undefined) {
    if (body.contactNumber === null || body.contactNumber === "") {
      value.contactNumber = null
    } else if (
      typeof body.contactNumber !== "string" ||
      !PHONE_RE.test(body.contactNumber.trim())
    ) {
      return { error: "Provide 11 digits starting with 09 or 08" }
    } else value.contactNumber = body.contactNumber.trim()
  }

  if (body.position !== undefined) {
    if (body.position === null || body.position === "") value.position = null
    else if (
      typeof body.position !== "string" ||
      body.position.trim().length > 100
    ) {
      return { error: "Position must be 100 characters or fewer" }
    } else value.position = body.position.trim()
  }

  if (body.employmentType !== undefined) {
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

  for (const field of optionalNullableFields) {
    if (body[field] === undefined) continue
    if (body[field] === null || body[field] === "") {
      if (field === "startDate") value.startDate = null
      else value[field] = null
      continue
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

    if (field === "departmentId" || field === "teamId" || field === "userId") {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return { error: `Provide a valid ${field}` }
      }
      value[field] = body[field].trim()
    }
  }

  return { value }
}
