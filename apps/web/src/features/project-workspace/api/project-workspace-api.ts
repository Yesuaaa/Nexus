import { apiRequest, apiStreamRequest } from "@/features/auth/api/auth-api"
import type {
  ManagedProjectDeliverable,
  ProjectStatus,
  ProjectTaskStatus,
} from "@/features/project-management/model/project-contracts"
import {
  serializeWorkspaceDirectoryState,
  type WorkspaceDirectoryState,
} from "../model/workspace-directory-state"

export type {
  ProjectDeliverableStatus,
  ProjectStatus,
  ProjectTaskStatus,
} from "@/features/project-management/model/project-contracts"

const projectWorkspaceListChangedEvent = "project-workspace-list-changed"
const projectWorkspaceListChangedStorageKey =
  "nexus.project-workspace-list-changed"

export function notifyProjectWorkspaceListChanged() {
  window.dispatchEvent(new Event(projectWorkspaceListChangedEvent))
  try {
    window.localStorage.setItem(
      projectWorkspaceListChangedStorageKey,
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
  } catch {
    // Keep same-tab refresh working when browser storage is unavailable.
  }
}

export function onProjectWorkspaceListChanged(
  callback: () => void,
  { crossTabOnly = false }: { crossTabOnly?: boolean } = {},
) {
  if (!crossTabOnly)
    window.addEventListener(projectWorkspaceListChangedEvent, callback)
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === projectWorkspaceListChangedStorageKey &&
      event.newValue !== null
    )
      callback()
  }
  window.addEventListener("storage", handleStorage)
  return () => {
    if (!crossTabOnly)
      window.removeEventListener(projectWorkspaceListChangedEvent, callback)
    window.removeEventListener("storage", handleStorage)
  }
}

export type ProjectTask = {
  employeeId?: string | null
  dueDate?: string | null
  id: string
  title: string
  role: string
  status: ProjectTaskStatus
}

export type ProjectDeliverableSubmission = {
  id: string
  version: number
  note: string | null
  status:
    | "IN_REVIEW"
    | "ESCALATED"
    | "REJECTED"
    | "APPROVED"
    | "SENT_TO_CLIENT"
    | "WITHDRAWN"
  submittedAt: string
  submittedById: string
  submittedBy: { id: string; fullName: string | null }
  reviewedAt: string | null
  feedback: string | null
  escalatedAt: string | null
  reviewedBy: { id: string; fullName: string | null } | null
  workflowFile: {
    id: string
    name: string
    mimeType: string
    size: number
    createdAt: string
  }
}

export type ProjectDeliverable = ManagedProjectDeliverable & {
  submissions?: ProjectDeliverableSubmission[]
}

export type ProjectNoteRevision = {
  id: string
  revision: number
  content: string
  authorId: string
  status:
    "SUBMITTED" | "ESCALATED" | "APPROVED" | "REVISION_REQUIRED" | "REJECTED"
  submittedAt: string
  reviewedAt: string | null
  feedback: string | null
  escalatedAt: string | null
  clientVisible: boolean
  publishedAt: string | null
  publishedById: string | null
  publishedBy: { id: string; fullName: string | null } | null
  supersededAt: string | null
  supersededByRevisionId: string | null
  supersededByRevision: { id: string; revision: number } | null
  unpublishedAt: string | null
  unpublishedById: string | null
  unpublishedBy: { id: string; fullName: string | null } | null
  author: { id: string; fullName: string | null }
  reviewedBy: { id: string; fullName: string | null } | null
}

export type ProjectWorkspaceNote = {
  id: string
  createdAt: string
  updatedAt: string
  createdBy: { id: string; fullName: string | null }
  revisions: ProjectNoteRevision[]
}

export type ProjectWorkspaceChangeRequest = {
  id: string
  kind: "CHANGE" | "CANCELLATION"
  details: string
  status: "PENDING" | "ACCEPTED" | "NOT_APPROVED"
  responseNote: string | null
  createdAt: string
  reviewedAt: string | null
  requestedBy: { fullName: string | null }
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
  status: ProjectStatus
  startDate: string | null
  createdAt: string
  updatedAt: string
  templateKey: string | null
  taskCount: number
  completedTaskCount: number
  plan?: ProjectWorkPlan | null
  milestones?: ProjectDeliverable[]
  notes?: ProjectWorkspaceNote[]
  changeRequests?: ProjectWorkspaceChangeRequest[]
  isTeamLead?: boolean
  hasTeamLead?: boolean
  isDepartmentHead?: boolean
  canReviewDeliverables?: boolean
  canReviewRequests?: boolean
  canUploadDeliverables: boolean
  staff?: {
    id: string
    fullName: string
    position: string | null
    status: string
    profileSpecialties: string[]
    approvedAt: string
    isTeamLead: boolean
  }[]
  canAssign: boolean
}

export type ProjectWorkspaceSummary = {
  id: string
  rowId: string
  kind: "group" | "ungrouped-project"
  name: string
  structure: "SEPARATE" | "MULTI_WORKSTREAM"
  status: ProjectStatus
  client: { id: string; fullName: string | null }
  updatedAt: string
  activityCount: number
  canCreate: boolean
  canManage: boolean
  canRename: boolean
  workstreams: Omit<
    ProjectWorkspaceWorkstream,
    "plan" | "milestones" | "staff" | "notes" | "changeRequests"
  >[]
}

export type ProjectWorkspaceDetail = Omit<
  ProjectWorkspaceSummary,
  "workstreams"
> & {
  workstreams: ProjectWorkspaceWorkstream[]
  kanbanColumns: { id: string; name: string }[]
  kanbanAssignments: { projectId: string; taskId: string; columnId: string }[]
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
    projectCounts: {
      total: number
      byStatus: Record<ProjectStatus, number>
    }
    resultsTruncated: boolean
  }>(`/api/project-workspace${suffix}`, { signal })
}

export const getProjectWorkspace = (id: string, signal?: AbortSignal) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(id)}`,
    { signal },
  )

export type WorkspaceDirectoryRow = {
  rowId: string
  id: string
  kind: "group" | "ungrouped-project"
  name: string
  clientName: string | null
  statuses: ProjectStatus[]
  projectCount: number
  departmentNames: string[]
  updatedAt: string
  progress: { completed: number; total: number } | null
  canManage: boolean
  canRename: boolean
}

export type AdminProjectWorkspaceMember = {
  id: string
  fullName: string
  position: string | null
}

export type AdminProjectWorkspaceProject = {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  client: { id: string; fullName: string | null }
  department: { id: string; name: string }
  workspace: { id: string; name: string } | null
  leads: AdminProjectWorkspaceMember[]
  team: (AdminProjectWorkspaceMember & { isTeamLead: boolean })[]
  startDate: string | null
  taskDueDates: string[]
  tasks: { total: number; completed: number; incomplete: number }
  progress: { completed: number; total: number } | null
}

export type AdminProjectManagementWorkspaceDetails = {
  identity: string
  kind: "group" | "ungrouped-project"
  id: string
  name: string
  structure: "SEPARATE" | "MULTI_WORKSTREAM" | null
  department: {
    id: string
    name: string
    head: {
      id: string
      fullName: string | null
      email: string
      position: string | null
    } | null
    memberCount: number
  }
  clients: { id: string; fullName: string | null }[]
  statuses: ProjectStatus[]
  projectCount: number
  unplannedProjectCount: number
  progress: { completed: number; total: number } | null
  teamMembers: AdminProjectWorkspaceMember[]
  projects: AdminProjectWorkspaceProject[]
  activity: {
    id: string
    projectId: string
    projectName: string
    type: string
    summary: string
    createdAt: string
    actor: { fullName: string | null } | null
  }[]
}

export type ProjectWorkspaceOverviewTask = {
  id: string
  title: string
  projectId: string
  projectName: string
  dueDate: string
  status: ProjectTaskStatus
}

export type ProjectWorkspaceOverview = {
  totals: {
    totalProjects: number
    inProgress: number
    completed: number
    onHold: number
    planned: number
    cancelled: number
    workspaceGroups: number
    projectsWithTasks: number
    projectsWithoutTasks: number
    totalTasks: number
    completedTasks: number
    outstandingTasks: number
    upcomingTasks: number
    overdueTasks: number
  }
  statusDistribution: { status: ProjectStatus; count: number }[]
  clientDistribution: { id: string; name: string; projectCount: number }[]
  workspaceProgress: {
    identity: string
    kind: "group" | "ungrouped-project"
    name: string
    projectCount: number
    completedTasks: number
    totalTasks: number
  }[]
  upcomingDeadlines: ProjectWorkspaceOverviewTask[]
  overdueTaskList: ProjectWorkspaceOverviewTask[]
}

export function projectWorkspaceHref(
  identity: string,
  returnState?: WorkspaceDirectoryState,
) {
  const query = returnState ? serializeWorkspaceDirectoryState(returnState) : ""
  return `/project-workspace/${encodeURIComponent(identity)}${query ? `?${query}` : ""}`
}

export type WorkspaceDirectoryQuery = Omit<WorkspaceDirectoryState, "sort"> & {
  sort: "recent" | "name" | "client" | "projects"
}

export function listWorkspaceDirectory(
  query: WorkspaceDirectoryQuery,
  signal: AbortSignal,
) {
  const params = new URLSearchParams({ ...query, page: String(query.page) })
  return apiRequest<{
    rows: WorkspaceDirectoryRow[]
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasWorkspaces: boolean
  }>(`/api/project-workspace/directory?${params}`, { signal })
}

export function getAdminProjectManagementWorkspaceDetails(
  departmentId: string,
  identity: string,
  signal?: AbortSignal,
) {
  return apiRequest<AdminProjectManagementWorkspaceDetails>(
    `/api/project-workspace/admin/departments/${encodeURIComponent(departmentId)}/workspaces/${encodeURIComponent(identity)}`,
    { signal },
  )
}

export const getProjectWorkspaceOverview = (signal?: AbortSignal) =>
  apiRequest<ProjectWorkspaceOverview>("/api/project-workspace/overview", {
    signal,
  })

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

export const assignProjectTeamLead = (
  workspaceId: string,
  projectId: string,
  employeeId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/team-lead`,
    { method: "PUT", body: JSON.stringify({ employeeId }) },
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
  columnId: string | null = null,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify({ status, columnId }) },
  )

const deliverablePath = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}`

const notePath = (workspaceId: string, projectId: string) =>
  `/api/project-workspace/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}/notes`

const noteRevisionPath = (
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
) =>
  `${notePath(workspaceId, projectId)}/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}`

export const createProjectNote = (
  workspaceId: string,
  projectId: string,
  content: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(notePath(workspaceId, projectId), {
    method: "POST",
    body: JSON.stringify({ content }),
  })

export const createProjectNoteRevision = (
  workspaceId: string,
  projectId: string,
  noteId: string,
  content: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${notePath(workspaceId, projectId)}/${encodeURIComponent(noteId)}/revisions`,
    { method: "POST", body: JSON.stringify({ content }) },
  )

export const reviewProjectNoteRevision = (
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
  input: {
    action: "APPROVE" | "REQUEST_REVISION" | "REJECT"
    feedback?: string
    clientVisible?: boolean
  },
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${noteRevisionPath(workspaceId, projectId, noteId, revisionId)}/review`,
    { method: "PATCH", body: JSON.stringify(input) },
  )

export const escalateProjectNoteRevision = (
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${noteRevisionPath(workspaceId, projectId, noteId, revisionId)}/escalate`,
    { method: "POST" },
  )

export const unpublishProjectNoteRevision = (
  workspaceId: string,
  projectId: string,
  noteId: string,
  revisionId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${noteRevisionPath(workspaceId, projectId, noteId, revisionId)}/unpublish`,
    { method: "POST" },
  )

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
  options: { uploadId?: string; note?: string } = {},
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
        uploadId: options.uploadId ?? crypto.randomUUID(),
        ...(options.note ? { note: options.note } : {}),
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

export const escalateProjectDeliverable = (
  workspaceId: string,
  projectId: string,
  deliverableId: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/escalate`,
    { method: "POST" },
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
  await downloadProjectWorkspaceFile(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/attachment`,
    fileName,
  )
}

export async function downloadProjectDeliverableSubmissionAttachment(
  workspaceId: string,
  projectId: string,
  deliverableId: string,
  submissionId: string,
  fileName: string,
) {
  await downloadProjectWorkspaceFile(
    `${deliverablePath(workspaceId, projectId, deliverableId)}/submissions/${encodeURIComponent(submissionId)}/attachment`,
    fileName,
  )
}

async function downloadProjectWorkspaceFile(path: string, fileName: string) {
  const response = await apiStreamRequest(path)
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const mutateKanbanColumn = (
  workspaceId: string,
  action: "create" | "rename" | "delete",
  columnId: string | null,
  name = "",
  afterColumnId?: string,
) =>
  apiRequest<ProjectWorkspaceDetail>(
    `/api/project-workspace/${encodeURIComponent(workspaceId)}/columns${columnId ? `/${encodeURIComponent(columnId)}` : ""}`,
    {
      method:
        action === "create" ? "POST" : action === "rename" ? "PATCH" : "DELETE",
      body: JSON.stringify({
        name,
        ...(afterColumnId ? { afterColumnId } : {}),
      }),
    },
  )
