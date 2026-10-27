export type PasswordField = "password" | "confirmation"

export type PasswordValues = Record<PasswordField, string>

export function validateStrongPassword(
  values: PasswordValues,
): Partial<Record<PasswordField, string>> {
  const errors: Partial<Record<PasswordField, string>> = {}
  const { password, confirmation } = values

  if (!password) errors.password = "Password is required."
  else if (password.length < 12) errors.password = "Use at least 12 characters."
  else if (!/[A-Z]/.test(password))
    errors.password = "Include at least one capital letter."
  else if (!/[a-z]/.test(password))
    errors.password = "Include at least one lowercase letter."
  else if (!/[0-9]/.test(password))
    errors.password = "Include at least one number."
  else if (!/[^A-Za-z0-9]/.test(password))
    errors.password = "Include at least one special character."

  if (!confirmation) errors.confirmation = "Please confirm your password."
  else if (password !== confirmation)
    errors.confirmation = "Passwords do not match."

  return errors
}
