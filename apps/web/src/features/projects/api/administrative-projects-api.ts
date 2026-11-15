import { apiRequest } from "@/features/auth/api/auth-api"
import type { ProjectWorkspaceDetail } from "@/features/project-workspace/api/project-workspace-api"

export type AdministrativeProject = ProjectWorkspaceDetail & {
  department: { id: string; name: string } | null
  workspaceGroup: { id: string; name: string; structure: string } | null
  capabilities: {
    read: boolean
    manage: false
    rename?: boolean
    approve: false
    release: false
    participate: false
    downloadFiles: false
  }
}
export function listAdministrativeProjects(
  filters: {
    search: string
    status: string
    departmentId: string
    page: number
  },
  signal: AbortSignal,
) {
  return apiRequest<{
    projects: AdministrativeProject[]
    departments: { id: string; name: string }[]
    total: number
    page: number
    pageSize: number
  }>(
    `/api/administrative-projects?${new URLSearchParams({ ...filters, page: String(filters.page) })}`,
    { signal },
  )
}
export function getAdministrativeProject(id: string, signal: AbortSignal) {
  return apiRequest<{ project: AdministrativeProject }>(
    `/api/administrative-projects/${encodeURIComponent(id)}`,
    { signal },
  )
}

export function renameAdministrativeWorkspace(id: string, name: string) {
  return apiRequest<{ saved: boolean }>(
    `/api/administrative-projects/${encodeURIComponent(id)}/workspace-name`,
    { method: "PATCH", body: JSON.stringify({ name }) },
  )
}
