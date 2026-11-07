import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"

const projectWorkspaceListChangedEvent = "project-workspace-list-changed"

export function notifyProjectWorkspaceListChanged() {
  window.dispatchEvent(new Event(projectWorkspaceListChangedEvent))
}

export function onProjectWorkspaceListChanged(callback: () => void) {
  window.addEventListener(projectWorkspaceListChangedEvent, callback)
  return () =>
    window.removeEventListener(projectWorkspaceListChangedEvent, callback)
}

export type ProjectTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE"

export type ProjectTask = {
  employeeId?: string | null
  dueDate?: string | null
  id: string
  title: string
  role: string
  status: ProjectTaskStatus
}

export type ProjectDeliverableStatus =
  "NOT_SUBMITTED" | "IN_REVIEW" | "REJECTED" | "APPROVED" | "SENT_TO_CLIENT"

export type ProjectDeliverable = {
  id: string
  title: string
  description: string | null
  expectedFileType: string | null
  deliveryStatus: ProjectDeliverableStatus
  rejectionReason: string | null
  reviewedAt: string | null
  sentToClientAt: string | null
  workflowFileId: string | null
  updatedAt: string
  completedAt: string | null
  workflowFile: {
    id: string
    name: string
    mimeType: string
    size: number
    uploaderId: string
    createdAt: string
    clientVisible: boolean
  } | null
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
  milestones?: ProjectDeliverable[]
  canUploadDeliverables: boolean
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
  canManage: boolean
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

export const renameProjectWorkspace = (workspaceId: string, name: string) =>
  apiRequest<{ saved: boolean }>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}`,
    { method: "PATCH", body: JSON.stringify({ name }) },
  )

export const cancelProjectWorkspace = (workspaceId: string) =>
  apiRequest<{ saved: boolean }>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/cancel`,
    { method: "POST" },
  )

export const updateProjectWorkspaceStatus = (
  workspaceId: string,
  action: "ON_HOLD" | "RESUME" | "COMPLETE",
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/status`,
    { method: "POST", body: JSON.stringify({ action }) },
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

const deliverablePath = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}`

export const updateProjectDeliverable = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  input: { title: string; description: string; expectedFileType: string },
) =>
  apiRequest<ProjectWorkspaceDetail>(
    deliverablePath(workspaceId, projectId, deliverableId),
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )

export async function uploadProjectDeliverable(
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  file: File,
) {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Choose a nonempty file up to 5 MB.")
  const types: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    txt: "text/plain",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
  const mimeType =
    file.type || types[file.name.split(".").at(-1)?.toLowerCase() || ""]
  if (!mimeType || !Object.values(types).includes(mimeType))
    throw new Error(
      "Choose a PDF, Word document, PNG, JPEG, or plain text file.",
    )
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Couldn't read this file."))
    reader.onload = () => {
      const value = reader.result
      if (typeof value !== "string")
        return reject(new Error("Couldn't read this file."))
      resolve(value.slice(value.indexOf(",") + 1))
    }
    reader.readAsDataURL(file)
  })
  return apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/attachment`,
    {
      method: "POST",
      body: JSON.stringify({
        uploadId: crypto.randomUUID(),
        name: file.name,
        mimeType,
        content,
      }),
    },
  )
}

export const removeProjectDeliverableAttachment = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/attachment`,
    { method: "DELETE" },
  )

export const approveProjectDeliverable = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/approve`,
    { method: "POST" },
  )

export const rejectProjectDeliverable = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  reason: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  )

export const sendProjectDeliverableToClient = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/send`,
    { method: "POST" },
  )

export async function downloadProjectDeliverableAttachment(
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  fileName: string,
) {
  const response = await apiStreamRequest(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/attachment`,
  )
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
