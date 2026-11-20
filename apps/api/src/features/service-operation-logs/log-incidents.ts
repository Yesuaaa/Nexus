import type { Request } from "express"
import { getPrisma } from "../../lib/db.js"
import { classifyServiceIncident } from "./incident-diagnostics.js"
import { resolveIncidentAuditContext } from "./incident-audit-context.js"
import { logContext, serviceLogEndpoint } from "./log-context.js"
import { loggedWorkflowActions } from "./log-writer.js"

const sources: Record<string, string> = {
  services: "catalog",
  "service-requests": "requests",
  client: "requests",
  "request-inbox": "requests",
  "request-workflows": "workflow",
  workload: "workload",
  "administrative-requests": "requests",
  "administrative-workload": "workload",
}
/** Incident persistence is best effort, independently of the rolled-back business transaction. */
export async function recordServiceIncident(
  request: Request,
  status: number,
  error: unknown,
) {
  const context = logContext.getStore()
  const source = sources[request.path.split("/")[2]]
  if (!context || !source || status < 500 || status > 599) return
  const endpoint = serviceLogEndpoint(request)
  const requestedAction =
    endpoint === "POST /api/request-workflows/:id/actions" &&
    typeof request.body === "object" &&
    request.body !== null &&
    "type" in request.body &&
    typeof request.body.type === "string" &&
    loggedWorkflowActions.some((action) => action === request.body.type)
      ? request.body.type
      : undefined
  const diagnostic = classifyServiceIncident(error, status, endpoint)
  const prisma = getPrisma()
  if (!prisma) return
  let audit = {}
  try {
    audit = await resolveIncidentAuditContext(
      prisma,
      request,
      endpoint,
      requestedAction,
    )
  } catch {
    // A failed enrichment must not prevent the base incident from being stored.
  }
  const data = {
    event: "API_FAILURE",
    action: requestedAction,
    source,
    outcome: "FAILURE",
    status,
    endpoint,
    failureCode: diagnostic.code,
    failureReason: diagnostic.reason,
    correlationId: context.correlationId,
    actorId: request.auth?.user.id,
    actorName: request.auth?.user.fullName?.trim() || undefined,
    actorRole: request.auth?.user.role,
    ...audit,
  }
  try {
    await prisma.serviceOperationLog.create({
      data,
    })
  } catch {
    // Fixed text only: database failure must not leak payloads or recurse.
    console.error("Unable to persist Service Operations incident", data)
  }
}
