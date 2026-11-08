import { apiRequest } from "@/features/auth/api/auth-api"
import type { ProjectDeliverableStatus } from "@/features/project-workspace/api/project-workspace-api"

export type ProjectWorkspace = {
  id: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  createdAt: string
  workspaceManaged: boolean
  canManage: boolean
  request: {
    id: string
    referenceNumber: string | null
    service: { name: string }
  } | null
  milestones: {
    id: string
    title: string
    completedAt: string | null
    deliveryStatus: ProjectDeliverableStatus
    sentToClientAt: string | null
  }[]
}

export const getProject = (id: string, signal?: AbortSignal) =>
  apiRequest<ProjectWorkspace>(`/api/projects/${encodeURIComponent(id)}`, {
    signal,
  })

export const updateMilestone = (
  projectId: string,
  milestoneId: string,
  completed: boolean,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
    { method: "PATCH", body: JSON.stringify({ completed }) },
  )
