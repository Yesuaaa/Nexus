export type AuthMode = "login" | "register"

export type AuthLanguage = "en" | "fil"

export type Account = {
  id: string
  email: string
  fullName: string | null
  contactNumber: string | null
  role: "SUPERADMIN" | "ADMIN" | "STAFF" | "USER"
  createdAt: string
}

export type RegistrationData = {
  fullName: string
  contactNumber: string
  email: string
  password: string
}
