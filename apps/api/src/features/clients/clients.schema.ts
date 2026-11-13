import { isStrongPassword } from "../../shared/password-policy.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { parsePage } from "../../shared/query/pagination.js"
import { isPlainObject, normalizedEmail } from "../../shared/validation.js"
import { validRegistrationProfile } from "../auth/auth.schema.js"

export function parseClientInput(value: unknown, creating: boolean) {
  if (!isPlainObject(value)) return null
  const input = value
  const email = normalizedEmail(input.email)
  if (
    !email ||
    !validRegistrationProfile(input.fullName, input.contactNumber) ||
    typeof input.isActive !== "boolean" ||
    (creating && !isStrongPassword(input.password))
  )
    return null
  return {
    email,
    fullName: (input.fullName as string).trim(),
    contactNumber: (input.contactNumber as string).trim(),
    isActive: input.isActive,
    ...(creating ? { password: input.password as string } : {}),
  }
}

export type ClientSort = "fullName" | "email" | "isActive" | "createdAt"
export type ClientFilters = {
  page: number
  search: string
  status: "" | "ACTIVE" | "INACTIVE"
  sortBy: ClientSort
  sortOrder: "asc" | "desc"
}

export function parseClientFilters(
  query: Record<string, unknown>,
): ClientFilters | null {
  const page = parsePage(query.page)
  const search = parseQueryString(query.search)
  const status = parseQueryString(query.status)
  const sortBy =
    query.sortBy === undefined ? "createdAt" : parseQueryString(query.sortBy)
  const sortOrder =
    query.sortOrder === undefined ? "desc" : parseQueryString(query.sortOrder)
  if (
    page === null ||
    search === null ||
    search.length > 100 ||
    status === null ||
    !["", "ACTIVE", "INACTIVE"].includes(status) ||
    sortBy === null ||
    !["fullName", "email", "isActive", "createdAt"].includes(sortBy) ||
    (sortOrder !== "asc" && sortOrder !== "desc")
  )
    return null
  return {
    page,
    search,
    status: status as ClientFilters["status"],
    sortBy: sortBy as ClientSort,
    sortOrder,
  }
}
