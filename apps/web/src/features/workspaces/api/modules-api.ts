import { apiRequest } from "@/features/auth/api/auth-api"

export type AdministrativeModule = {
  id: string
  title: string
  description: string
  href: string
}

export function getAdministrativeModule(id: string, signal: AbortSignal) {
  return apiRequest<{ module: AdministrativeModule }>(
    `/api/modules/${encodeURIComponent(id)}`,
    { signal },
  )
}
