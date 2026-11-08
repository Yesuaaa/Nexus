import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"

export type ProjectClientReviewStatus = "APPROVED" | "REVISION_REQUESTED"
export type ProjectChangeRequestStatus = "PENDING" | "ACCEPTED" | "NOT_APPROVED"
export type ProjectChangeRequestKind = "CHANGE" | "CANCELLATION"

export type ProjectDeliverable = {
  id: string
  title: string
  description: string | null
  expectedFileType: string | null
  sentToClientAt: string | null
  workflowFile: {
    id: string
    name: string
    mimeType: string
    size: number
    createdAt: string
  }
  clientReviews: {
    status: ProjectClientReviewStatus
    note: string | null
    workflowFileId: string | null
    createdAt: string
  }[]
}

export type ProjectChangeRequest = {
  id: string
  kind: ProjectChangeRequestKind
  details: string
  status: ProjectChangeRequestStatus
  responseNote: string | null
  createdAt: string
  reviewedAt: string | null
  requestedBy: { fullName: string | null }
}

export type ProjectWorkspace = {
  id: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  createdAt: string
  canManage: boolean
  request: {
    id: string
    referenceNumber: string | null
    service: { name: string }
  } | null
  milestones: { id: string; title: string; completedAt: string | null }[]
  progress?: { completed: number; total: number }
  deliverables?: ProjectDeliverable[]
  changeRequests?: ProjectChangeRequest[]
  canReviewChanges?: boolean
}

export type ClientProjectSummary = {
  id: string
  name: string
  description: string | null
  status: string
  startDate: string | null
  updatedAt: string
  request: ProjectWorkspace["request"]
  completedTasks: number
  taskCount: number
  deliverableCount: number
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

export const listClientProjects = (signal?: AbortSignal) =>
  apiRequest<ClientProjectSummary[]>("/api/projects", { signal })

export const updateProjectBrief = (
  projectId: string,
  brief: { name: string; description: string },
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/brief`,
    { method: "PATCH", body: JSON.stringify(brief) },
  )

export const createProjectChangeRequest = (
  projectId: string,
  details: string,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/change-requests`,
    { method: "POST", body: JSON.stringify({ details }) },
  )

export const createProjectCancellationRequest = (
  projectId: string,
  details: string,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/cancellation-requests`,
    { method: "POST", body: JSON.stringify({ details }) },
  )

export const reviewProjectChangeRequest = (
  projectId: string,
  changeRequestId: string,
  decision: "ACCEPTED" | "NOT_APPROVED",
  responseNote: string,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/change-requests/${encodeURIComponent(changeRequestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision, responseNote }),
    },
  )

export const reviewProjectCancellationRequest = (
  projectId: string,
  cancellationRequestId: string,
  decision: "ACCEPTED" | "NOT_APPROVED",
  responseNote: string,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/cancellation-requests/${encodeURIComponent(cancellationRequestId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision, responseNote }),
    },
  )

export const reviewClientDeliverable = (
  projectId: string,
  deliverableId: string,
  decision: ProjectClientReviewStatus,
  note: string,
) =>
  apiRequest<ProjectWorkspace>(
    `/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/review`,
    { method: "POST", body: JSON.stringify({ decision, note }) },
  )

export async function createClientDeliverablePreviewUrl(
  projectId: string,
  deliverableId: string,
) {
  const response = await apiStreamRequest(
    `/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/file`,
  )
  return URL.createObjectURL(await response.blob())
}

export async function downloadClientDeliverable(
  projectId: string,
  deliverable: ProjectDeliverable,
) {
  const url = await createClientDeliverablePreviewUrl(projectId, deliverable.id)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = deliverable.workflowFile.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
