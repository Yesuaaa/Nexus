/**
 * Up to two uppercase initials (first + last name, or the first two letters
 * of a single name), or "" for a blank name. Safe for non-BMP characters.
 */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  const first = Array.from(parts[0])
  const letters =
    parts.length > 1
      ? `${first[0]}${Array.from(parts[parts.length - 1])[0]}`
      : first.slice(0, 2).join("")
  return letters.toUpperCase()
}
