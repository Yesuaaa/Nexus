/**
 * Shared query-string parsing utilities. Page numbers are parsed by
 * `parsePage` in `./query/pagination.ts`.
 */

export function parseQueryString(value: unknown): string | null {
  if (value === undefined) return ""
  return typeof value === "string" ? value.trim() : null
}
