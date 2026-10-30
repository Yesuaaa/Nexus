export interface ClientServiceRequestInput {
  serviceId: string
  packageId?: string | null
  preferredSpecialistId?: string | null
  title: string
  description?: string | null
  requirementsPayload?: Record<string, unknown> | null
}

export function parseClientServiceRequestInput(body: unknown): {
  data?: ClientServiceRequestInput
  error?: string
} {
  if (!body || typeof body !== "object") {
    return { error: "Request payload must be an object" }
  }

  const payload = body as Record<string, unknown>

  const serviceId = payload.serviceId
  if (typeof serviceId !== "string" || !serviceId.trim()) {
    return { error: "A valid service is required" }
  }

  const title = payload.title
  if (typeof title !== "string" || title.trim().length < 3) {
    return { error: "Title must be at least 3 characters" }
  }
  if (title.trim().length > 120) {
    return { error: "Title must not exceed 120 characters" }
  }

  let packageId: string | null = null
  if (payload.packageId !== undefined && payload.packageId !== null) {
    if (typeof payload.packageId !== "string" || !payload.packageId.trim()) {
      return { error: "Invalid package selection" }
    }
    packageId = payload.packageId.trim()
  }

  let preferredSpecialistId: string | null = null
  if (
    payload.preferredSpecialistId !== undefined &&
    payload.preferredSpecialistId !== null
  ) {
    if (
      typeof payload.preferredSpecialistId !== "string" ||
      !payload.preferredSpecialistId.trim()
    ) {
      return { error: "Invalid preferred specialist selection" }
    }
    preferredSpecialistId = payload.preferredSpecialistId.trim()
  }

  let description: string | null = null
  if (payload.description !== undefined && payload.description !== null) {
    if (typeof payload.description !== "string") {
      return { error: "Description must be a string" }
    }
    description = payload.description.trim() || null
  }

  let requirementsPayload: Record<string, unknown> | null = null
  if (
    payload.requirementsPayload !== undefined &&
    payload.requirementsPayload !== null
  ) {
    if (
      typeof payload.requirementsPayload !== "object" ||
      Array.isArray(payload.requirementsPayload)
    ) {
      return { error: "Requirements payload must be an object" }
    }
    requirementsPayload = payload.requirementsPayload as Record<string, unknown>
  }

  return {
    data: {
      serviceId: serviceId.trim(),
      packageId,
      preferredSpecialistId,
      title: title.trim(),
      description,
      requirementsPayload,
    },
  }
}
