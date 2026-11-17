import { isContactNumber } from "../../shared/validation.js"

export function validRegistrationEmail(email: string): boolean {
  return /^[A-Za-z0-9]+([._+-][A-Za-z0-9]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(com|ph)$/i.test(
    email,
  )
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
    isContactNumber(contactNumber.trim())
  )
}

export function validSelfRegistrationProfile(
  fullName: unknown,
  contactNumber: unknown,
): fullName is string {
  return (
    typeof fullName === "string" &&
    fullName.trim().length >= 2 &&
    fullName.trim().length <= 100 &&
    /^\p{L}[\p{L} .'’-]*$/u.test(fullName.trim()) &&
    typeof contactNumber === "string" &&
    /^(08|09)\d{9}$/.test(contactNumber.trim())
  )
}
