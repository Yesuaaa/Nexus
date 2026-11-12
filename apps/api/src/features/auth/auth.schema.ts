import { isContactNumber } from "../../shared/validation.js"

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
