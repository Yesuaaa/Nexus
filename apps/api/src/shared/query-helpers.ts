/**
 * Shared query-string parsing utilities for pagination and search.
 * Used by employee and department routes to avoid duplicating parsePage / parseQueryString.
 */

export function parsePage(value: unknown): number | null {
  if (value === undefined) return 1
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 1_000_000
    ? page
    : null
}

export function parseQueryString(value: unknown): string | null {
  if (value === undefined) return ""
  return typeof value === "string" ? value.trim() : null
}
