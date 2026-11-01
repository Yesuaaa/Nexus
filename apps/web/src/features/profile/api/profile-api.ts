import { apiRequest } from "@/features/auth/api/auth-api"
import type { Account } from "@/features/auth/model/types"

export type PortfolioProject = {
  title: string
  summary: string
  contribution: string
  thumbnailUrl: string
  projectUrl: string
  isPublished: boolean
}
export type SpecialistProfile = {
  bio: string
  imageUrl: string
  specialties: string[]
  updatedAt: string
  socialLinks: { platform: string; url: string }[]
  projects: PortfolioProject[]
}
export type Profile = {
  imageUrl?: string | null
  bannerUrl?: string | null
  user: Account
  employee: {
    employeeId: string
    position: string | null
    employmentType: string
    status: string
    startDate: string | null
    department: { id: string; name: string } | null
    team: { id: string; name: string } | null
  } | null
  specialist: SpecialistProfile | null
}
export function uploadProfileImage(kind: "avatar" | "banner" | "project", dataUrl: string) { return apiRequest<{ url: string; profile: Profile | null }>("/api/auth/profile/images", { method: "POST", body: JSON.stringify({ kind, dataUrl }) }) }
export function getProfile(signal?: AbortSignal) {
  return apiRequest<Profile>("/api/auth/profile", { signal })
}
export function savePersonalProfile(fullName: string, contactNumber: string) {
  return apiRequest<Profile>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify({ fullName, contactNumber }),
  })
}
export function saveSpecialistProfile(data: SpecialistProfile) {
  return apiRequest<Profile>("/api/auth/profile/specialist", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}
export function changeProfilePassword(
  currentPassword: string,
  newPassword: string,
) {
  return apiRequest<void>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
