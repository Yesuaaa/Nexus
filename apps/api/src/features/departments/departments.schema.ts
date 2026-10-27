export interface DepartmentInput {
  name: string
  code: string | null
  description: string | null
  headId: string | null
}

export interface TeamInput {
  name: string
  description: string | null
  leadId: string | null
}

export function validateDepartmentCreateInput(
  body: unknown,
):
  { value: DepartmentInput; error?: never } | { value?: never; error: string } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const code =
    typeof input.code === "string" ? input.code.trim().toUpperCase() : null
  const description =
    typeof input.description === "string" ? input.description.trim() : null
  const headId =
    typeof input.headId === "string" && input.headId.trim()
      ? input.headId.trim()
      : null

  if (!name || name.length < 2 || name.length > 80) {
    return { error: "Department name must be between 2 and 80 characters" }
  }
  if (code && (code.length < 2 || code.length > 20)) {
    return { error: "Department code must be between 2 and 20 characters" }
  }

  return {
    value: {
      name,
      code: code || null,
      description: description || null,
      headId,
    },
  }
}

export function validateDepartmentUpdateInput(body: unknown):
  | {
      value: {
        name?: string
        code?: string | null
        description?: string | null
        headId?: string | null
      }
      error?: never
    }
  | { value?: never; error: string } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const name = typeof input.name === "string" ? input.name.trim() : undefined
  const code =
    input.code !== undefined
      ? typeof input.code === "string" && input.code.trim()
        ? input.code.trim().toUpperCase()
        : null
      : undefined
  const description =
    input.description !== undefined
      ? typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null
      : undefined
  const headId =
    input.headId !== undefined
      ? typeof input.headId === "string" && input.headId.trim()
        ? input.headId.trim()
        : null
      : undefined

  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    return { error: "Department name must be between 2 and 80 characters" }
  }
  if (
    code !== undefined &&
    code !== null &&
    (code.length < 2 || code.length > 20)
  ) {
    return { error: "Department code must be between 2 and 20 characters" }
  }

  return { value: { name, code, description, headId } }
}

export function validateMemberAssignmentInput(body: unknown):
  | {
      value: { employeeIds?: string[]; userIds?: string[] }
      error?: never
    }
  | { value?: never; error: string } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const employeeIds = input.employeeIds
  const userIds = input.userIds

  if (
    (employeeIds === undefined && userIds === undefined) ||
    (employeeIds !== undefined &&
      (!Array.isArray(employeeIds) ||
        employeeIds.length === 0 ||
        employeeIds.length > 1000 ||
        !employeeIds.every(
          (employeeId) =>
            typeof employeeId === "string" &&
            employeeId.length > 0 &&
            employeeId.length <= 80,
        ))) ||
    (userIds !== undefined &&
      (!Array.isArray(userIds) ||
        userIds.length === 0 ||
        userIds.length > 1000 ||
        !userIds.every(
          (userId) =>
            typeof userId === "string" &&
            userId.length > 0 &&
            userId.length <= 80,
        )))
  ) {
    return { error: "Provide a list of employee IDs to assign" }
  }

  return {
    value: {
      employeeIds: employeeIds as string[] | undefined,
      userIds: userIds as string[] | undefined,
    },
  }
}

export function validateTeamCreateInput(
  body: unknown,
): { value: TeamInput; error?: never } | { value?: never; error: string } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const description =
    typeof input.description === "string" ? input.description.trim() : null
  const leadId =
    typeof input.leadId === "string" && input.leadId.trim()
      ? input.leadId.trim()
      : null

  if (!name || name.length < 2 || name.length > 80) {
    return { error: "Team name must be between 2 and 80 characters" }
  }

  return { value: { name, description: description || null, leadId } }
}

export function validateTeamUpdateInput(body: unknown):
  | {
      value: {
        name?: string
        description?: string | null
        leadId?: string | null
      }
      error?: never
    }
  | { value?: never; error: string } {
  const input = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const name = typeof input.name === "string" ? input.name.trim() : undefined
  const description =
    input.description !== undefined
      ? typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null
      : undefined
  const leadId =
    input.leadId !== undefined
      ? typeof input.leadId === "string" && input.leadId.trim()
        ? input.leadId.trim()
        : null
      : undefined

  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    return { error: "Team name must be between 2 and 80 characters" }
  }

  return { value: { name, description, leadId } }
}
