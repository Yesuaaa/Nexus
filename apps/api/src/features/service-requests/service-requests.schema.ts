import { randomUUID } from "node:crypto"
import type { ServiceRequestStatus } from "../../generated/prisma/client.js"
import { parsePage, parseQueryString } from "../../shared/query-helpers.js"

export type ServiceRequestFilters = {
  page: number
  search: string
  status: ServiceRequestStatus | ""
}

const statuses: ServiceRequestStatus[] = [
  "CANCELLED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CLOSED",
  "AWAITING_CLIENT_INFO",
  "READY_FOR_QUOTATION",
]

export function parseServiceRequestFilters(
  query: Record<string, unknown>,
): ServiceRequestFilters | null {
  const page = parsePage(query.page)
  const search = parseQueryString(query.search)
  const status = parseQueryString(query.status)
  const selectedStatus = statuses.find((value) => value === status)
  if (
    page === null ||
    page > 100_000 ||
    search === null ||
    search.length > 100 ||
    status === null ||
    (status !== "" && !selectedStatus)
  )
    return null
  return { page, search, status: selectedStatus ?? "" }
}

export type ServiceRequestInput = {
  serviceId: string
  packageId: string | null
  packageTier: string | null
  preferredSpecialistId: string | null
  submissionKey: string
  goals: string
  requirements: string
  expectedTimeline: string
  additionalDetails: string
}

export function validateServiceRequestInput(
  body: unknown,
):
  | { value: ServiceRequestInput; error?: never }
  | { value?: never; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { error: "Invalid service request" }
  const input = body as Record<string, unknown>
  const text = (name: string) =>
    typeof input[name] === "string" ? input[name].trim() : ""
  const serviceId = text("serviceId")
  if (!serviceId || serviceId.length > 200) return { error: "Select a service" }

  for (const field of ["packageId", "packageTier"] as const) {
    if (
      input[field] !== undefined &&
      input[field] !== null &&
      (typeof input[field] !== "string" ||
        !text(field) ||
        text(field).length > 200)
    ) {
      return { error: "Invalid package selection" }
    }
  }

  for (const field of ["preferredSpecialistId", "specialistId"] as const) {
    if (
      input[field] !== undefined &&
      input[field] !== null &&
      (typeof input[field] !== "string" ||
        !text(field) ||
        text(field).length > 200)
    ) {
      return { error: "Invalid specialist selection" }
    }
  }

  let submissionKey: string
  if (
    input.submissionKey !== undefined &&
    input.submissionKey !== null &&
    text("submissionKey") !== ""
  ) {
    const key = text("submissionKey")
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        key,
      )
    ) {
      return {
        error: "Invalid request reference. Please start a new request.",
      }
    }
    submissionKey = key
  } else if (
    input.submissionKey !== undefined &&
    input.submissionKey !== null &&
    text("submissionKey") === ""
  ) {
    return {
      error: "Invalid request reference. Please start a new request.",
    }
  } else {
    submissionKey = randomUUID()
  }

  for (const field of [
    "goals",
    "projectGoals",
    "requirements",
    "projectRequirements",
    "expectedTimeline",
    "additionalDetails",
  ] as const) {
    if (input[field] !== undefined && typeof input[field] !== "string") {
      const limit =
        field === "expectedTimeline"
          ? 300
          : field === "goals" || field === "projectGoals"
            ? 2000
            : 5000
      return { error: `Invalid ${field}. Use ${limit} characters or fewer.` }
    }
  }

  const hasGoalsKey =
    input.goals !== undefined || input.projectGoals !== undefined
  const hasReqsKey =
    input.requirements !== undefined || input.projectRequirements !== undefined

  const rawGoals = text("goals") || text("projectGoals")
  const rawRequirements = text("requirements") || text("projectRequirements")

  const goals = hasGoalsKey ? rawGoals : rawRequirements.slice(0, 2000)
  const requirements = hasReqsKey ? rawRequirements : rawGoals.slice(0, 5000)
  const expectedTimeline = text("expectedTimeline")
  const additionalDetails = text("additionalDetails")

  if (!goals || !requirements || !expectedTimeline) {
    return {
      error: "Project goals, requirements, and expected timeline are required",
    }
  }

  const limits = {
    goals: 2000,
    requirements: 5000,
    expectedTimeline: 300,
    additionalDetails: 5000,
  }

  for (const [field, limit] of Object.entries(limits)) {
    const val =
      field === "goals"
        ? goals
        : field === "requirements"
          ? requirements
          : field === "expectedTimeline"
            ? expectedTimeline
            : additionalDetails
    if (val.length > limit) {
      return { error: `Invalid ${field}. Use ${limit} characters or fewer.` }
    }
  }

  return {
    value: {
      serviceId,
      packageId:
        input.packageId === null || input.packageId === undefined
          ? null
          : text("packageId"),
      packageTier:
        input.packageTier === null || input.packageTier === undefined
          ? null
          : text("packageTier"),
      preferredSpecialistId:
        input.preferredSpecialistId !== undefined
          ? input.preferredSpecialistId === null
            ? null
            : text("preferredSpecialistId")
          : input.specialistId === undefined || input.specialistId === null
            ? null
            : text("specialistId"),
      submissionKey,
      goals,
      requirements,
      expectedTimeline,
      additionalDetails,
    },
  }
}
