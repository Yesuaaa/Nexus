export type ServiceInput = {
  name: string
  description: string
  departmentIds: string[]
  isActive: boolean
}

export type ValidationResult =
  { value: ServiceInput; error?: never } | { value?: never; error: string }

export function validateServiceInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { error: "Service information is required" }
  }

  const input = body as Record<string, unknown>
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const description =
    typeof input.description === "string" ? input.description.trim() : ""
  const hasInvalidDepartmentIds =
    !Array.isArray(input.departmentIds) ||
    input.departmentIds.some(
      (id) => typeof id !== "string" || id.trim().length === 0,
    )
  const departmentIds = Array.isArray(input.departmentIds)
    ? [
        ...new Set(
          input.departmentIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean),
        ),
      ]
    : []

  if (name.length < 2 || name.length > 100) {
    return { error: "Service name must be between 2 and 100 characters" }
  }
  if (description.length < 2 || description.length > 500) {
    return { error: "Description must be between 2 and 500 characters" }
  }
  if (hasInvalidDepartmentIds || departmentIds.length === 0) {
    return { error: "At least one responsible department is required" }
  }
  if (typeof input.isActive !== "boolean") {
    return { error: "Service status must be active or inactive" }
  }

  return {
    value: { name, description, departmentIds, isActive: input.isActive },
  }
}
