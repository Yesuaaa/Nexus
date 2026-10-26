export function normalizedEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return undefined
  return email
}

export function validRegistrationProfile(
  fullName: unknown,
  contactNumber: unknown,
): fullName is string {
  return (
    typeof fullName === "string" &&
    fullName.trim().length >= 2 &&
    fullName.trim().length <= 100 &&
    typeof contactNumber === "string" &&
    /^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber.trim())
  )
}
