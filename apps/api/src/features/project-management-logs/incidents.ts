import type { Request } from "express"
import { getPrisma } from "../../lib/db.js"
import { classifyServiceIncident } from "../service-operation-logs/incident-diagnostics.js"
import {
  logContext,
  serviceLogEndpoint,
} from "../service-operation-logs/log-context.js"
import { auditLabel } from "./events.js"

const roots = {
  "project-workspace": "workspace",
  projects: "client",
  "administrative-projects": "workspace",
  "project-management": "workspace",
} as const

const workspace = "/api/project-workspace"
const stream = `${workspace}/:id/projects/:projectId`
const deliverable = `${stream}/deliverables/:deliverableId`

export const projectIncidentOperations: Readonly<Record<string, string>> = {
  [`GET ${workspace}`]: "loading workspaces",
  [`GET ${workspace}/directory`]: "loading the workspace directory",
  [`GET ${workspace}/overview`]: "loading the workspace overview",
  [`GET ${workspace}/templates`]: "loading project templates",
  [`GET ${workspace}/approved-bookings`]: "loading approved bookings",
  [`GET ${workspace}/admin/departments/:departmentId/workspaces/:identity`]:
    "loading administrative workspace details",
  [`POST ${workspace}`]: "setting up a workspace",
  [`GET ${workspace}/:id`]: "loading a workspace",
  [`PATCH ${workspace}/:id`]: "renaming a workspace",
  [`POST ${workspace}/:id/cancel`]: "cancelling a workspace",
  [`POST ${workspace}/:id/status`]: "changing workspace status",
  [`PUT ${stream}/team-lead`]: "assigning a project team lead",
  [`PUT ${stream}/plan`]: "saving a work plan",
  [`POST ${stream}/tasks`]: "adding a task",
  [`PATCH ${stream}/tasks/:taskId`]: "changing task status",
  [`PATCH ${deliverable}`]: "editing a deliverable",
  [`POST ${deliverable}/attachment`]: "uploading a deliverable attachment",
  [`DELETE ${deliverable}/attachment`]: "removing a deliverable attachment",
  [`GET ${deliverable}/attachment`]: "loading a deliverable attachment",
  [`POST ${deliverable}/approve`]: "approving a deliverable",
  [`POST ${deliverable}/reject`]: "rejecting a deliverable",
  [`POST ${deliverable}/send`]: "sharing a deliverable",
  "GET /api/projects": "loading projects",
  "GET /api/projects/calendar": "loading the project calendar",
  "GET /api/projects/:id": "loading project details",
  "GET /api/projects/:id/deliverables/:milestoneId/file":
    "loading a shared deliverable",
  "POST /api/projects/:id/deliverables/:milestoneId/review":
    "reviewing a shared deliverable",
  "POST /api/projects/:id/change-requests": "submitting a change request",
  "PATCH /api/projects/:id/change-requests/:changeRequestId":
    "reviewing a change request",
  "POST /api/projects/:id/cancellation-requests":
    "submitting a cancellation request",
  "PATCH /api/projects/:id/cancellation-requests/:cancellationRequestId":
    "reviewing a cancellation request",
  "PATCH /api/projects/:id/brief": "editing a project brief",
  "PATCH /api/projects/:id/milestones/:milestoneId":
    "changing milestone completion",
  "GET /api/administrative-projects":
    "loading the administrative project directory",
  "GET /api/administrative-projects/:id":
    "loading administrative project details",
  "PATCH /api/administrative-projects/:id/workspace-name":
    "renaming a workspace administratively",
  "GET /api/project-management/overview":
    "loading the Project Management overview",
}

export function projectIncidentMessage(endpoint: string | null) {
  const operation =
    endpoint && Object.hasOwn(projectIncidentOperations, endpoint)
      ? projectIncidentOperations[endpoint]
      : undefined
  return operation
    ? `Request failed while ${operation}`
    : "Project Management request failed"
}

export async function recordProjectIncident(
  request: Request,
  status: number,
  error: unknown,
) {
  const context = logContext.getStore()
  const root = request.path.split("/")[2]?.toLowerCase() ?? ""
  if (!context || status < 500 || status > 599 || !Object.hasOwn(roots, root))
    return
  const candidate = serviceLogEndpoint(request)
  const endpoint =
    candidate && Object.hasOwn(projectIncidentOperations, candidate)
      ? candidate
      : undefined
  const diagnostic = classifyServiceIncident(error, status, endpoint)
  const actor = request.auth?.user
  const source = endpoint?.includes("/deliverables/")
    ? "deliverables"
    : endpoint && /\/(plan|tasks|milestones)(\/|$)/.test(endpoint)
      ? "planning"
      : roots[root as keyof typeof roots]
  const data = {
    event: "API_FAILURE",
    outcome: "FAILURE",
    source,
    endpoint,
    actorId: actor?.id,
    actorName: auditLabel(actor?.fullName, 100),
    actorRole: actor?.role,
    correlationId: context.correlationId,
    status,
    failureCode: diagnostic.code,
    failureReason: diagnostic.reason,
  }
  try {
    const prisma = getPrisma()
    if (!prisma) throw new Error("Database unavailable")
    await prisma.projectManagementLog.create({ data })
  } catch {
    console.error("Unable to persist Project Management incident", {
      correlationId: data.correlationId,
      endpoint,
      status,
      failureCode: diagnostic.code,
    })
  }
}
