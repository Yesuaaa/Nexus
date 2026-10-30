export type ServiceRequestInput = {
  serviceId: string
  packageId: string | null
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
  for (const field of ["packageId", "preferredSpecialistId"] as const) {
    if (
      input[field] !== null &&
      (typeof input[field] !== "string" ||
        !text(field) ||
        text(field).length > 200)
    )
      return {
        error: `Invalid ${field === "packageId" ? "package" : "specialist"} selection`,
      }
  }
  const submissionKey = text("submissionKey")
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      submissionKey,
    )
  )
    return { error: "Invalid request reference. Please start a new request." }
  const limits = {
    goals: 2000,
    requirements: 5000,
    expectedTimeline: 300,
    additionalDetails: 5000,
  }
  for (const [field, limit] of Object.entries(limits)) {
    if (field !== "additionalDetails" && !text(field))
      return {
        error:
          "Project goals, requirements, and expected timeline are required",
      }
    if (
      (input[field] !== undefined && typeof input[field] !== "string") ||
      text(field).length > limit
    )
      return { error: `Invalid ${field}. Use ${limit} characters or fewer.` }
  }
  return {
    value: {
      serviceId,
      packageId: input.packageId === null ? null : text("packageId"),
      preferredSpecialistId:
        input.preferredSpecialistId === null
          ? null
          : text("preferredSpecialistId"),
      submissionKey,
      goals: text("goals"),
      requirements: text("requirements"),
      expectedTimeline: text("expectedTimeline"),
      additionalDetails: text("additionalDetails"),
    },
  }
}
