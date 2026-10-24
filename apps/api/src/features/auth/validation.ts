export function normalizedEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return undefined
  return email
}
