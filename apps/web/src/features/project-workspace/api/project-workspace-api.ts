import { apiRequest } from "@/features/auth/api/auth-api"

export type ProjectTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE"

export type ProjectTask = {
  id: string
  title: string
  role: string
  status: ProjectTaskStatus
}

export type ProjectWorkPlan = {
  phases: { id: string; title: string; tasks: ProjectTask[] }[]
}

export type ProjectWorkspaceTemplate = {
  key: string
  name: string
  type: string
  description: string
  recommendedFor: string[]
  phases: { title: string; tasks: { title: string; role: string }[] }[]
}

export type ProjectWorkspaceBooking = {
  projectId: string
  requestId: string
  name: string
  serviceName: string
  referenceNumber: string | null
  workflowState: string
  conversationId: string | null
  client: { id: string; fullName: string | null }
}

export type ProjectWorkspaceWorkstream = {
  id: string
  requestId: string | null
  name: string
  description: string | null
  serviceName: string
  referenceNumber: string | null
  workflowState: string | null
  status: string
  startDate: string | null
  createdAt: string
  updatedAt: string
  templateKey: string | null
  taskCount: number
  completedTaskCount: number
  plan?: ProjectWorkPlan | null
  milestones?: { id: string; title: string; completedAt: string | null }[]
  staff?: {
    id: string
    fullName: string
    position: string | null
    status: string
    profileSpecialties: string[]
    approvedAt: string
  }[]
  canAssign: boolean
}

export type ProjectWorkspaceSummary = {
  id: string
  name: string
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  status: string
  client: { id: string; fullName: string | null }
  updatedAt: string
  activityCount: number
  canCreate: boolean
  workstreams: Omit<
    ProjectWorkspaceWorkstream,
    "plan" | "milestones" | "staff"
  >[]
}

export type ProjectWorkspaceDetail = Omit<
  ProjectWorkspaceSummary,
  "workstreams"
> & {
  workstreams: ProjectWorkspaceWorkstream[]
  activity: {
    id: string
    type: string
    summary: string
    createdAt: string
    actor: { fullName: string | null } | null
    projectName: string
  }[]
}

export const listProjectWorkspaces = (
  options: { sort?: "recent" | "most-active"; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams()
  if (options.sort) query.set("sort", options.sort)
  if (options.limit) query.set("limit", String(options.limit))
  const suffix = query.size ? `?${query.toString()}` : ""
  return apiRequest<{
    workspaces: ProjectWorkspaceSummary[]
    canCreate: boolean
  }>(`/api/project-workspace${suffix}`, { signal })
}

export const getProjectWorkspace = (id: string, signal?: AbortSignal) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(id)}`,
    { signal },
  )

export const listProjectWorkspaceTemplates = (signal?: AbortSignal) =>
  apiRequest<ProjectWorkspaceTemplate[]>("/api/project-workspace/templates", {
    signal,
  })

export const listApprovedProjectBookings = (signal?: AbortSignal) =>
  apiRequest<ProjectWorkspaceBooking[]>(
    "/api/project-workspace/approved-bookings",
    { signal },
  )

export const createProjectWorkspaces = (input: {
  customPlans?: Record<string, ProjectWorkPlan>
  requestIds: string[]
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  name: string
  templateKeys: Record<string, string>
}) =>
  apiRequest<{ workspaces: { id: string; name: string }[] }>(
    "/api/project-workspace",
    { method: "POST", body: JSON.stringify(input) },
  )

export const saveProjectPlan = (
  workspaceId: string,
  projectId: string,
  plan: ProjectWorkPlan,
  expectedUpdatedAt: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/plan`,
    { method: "PUT", body: JSON.stringify({ plan, expectedUpdatedAt }) },
  )

export const addProjectTask = (
  workspaceId: string,
  projectId: string,
  input: { phaseId: string; title: string; role?: string },
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks`,
    { method: "POST", body: JSON.stringify(input) },
  )

export const updateProjectTask = (
  workspaceId: string,
  projectId: string,
  taskId: string,
  status: ProjectTaskStatus,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify({ status }) },
  )
