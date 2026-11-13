/**
 * Shared query-string parsing utilities. Page numbers are parsed by
 * `parsePage` in `./query/pagination.ts`.
 */

export function parseQueryString(value: unknown): string | null {
  if (value === undefined) return ""
  return typeof value === "string" ? value.trim() : null
}

/** Express's simple parser leaves bracketed query keys literal. Reject them
 * rather than silently replacing a malformed filter with its default. */
export function hasStructuredFilters(
  query: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return Object.keys(query).some((key) =>
    fields.some((field) => key.startsWith(`${field}[`)),
  )
}
