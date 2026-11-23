import type { Request } from "express"
import type { PrismaClient } from "../../generated/prisma/client.js"
import { isRecordId } from "../../shared/validation.js"
import {
  auditCode,
  auditDate,
  auditText,
  type ServiceLogChange,
} from "./audit-context.js"

export type ServiceIncidentAuditContext = {
  subjectId?: string
  requestId?: string
  targetType?: string
  targetLabel?: string
  changes?: ServiceLogChange[]
}

function bodyOf(request: Request): Record<string, unknown> {
  return typeof request.body === "object" && request.body !== null
    ? (request.body as Record<string, unknown>)
    : {}
}

function recordId(value: unknown) {
  return typeof value === "string" && isRecordId(value) ? value : undefined
}

function routeRecordId(request: Request, endpoint: string) {
  const direct = recordId(request.params.id)
  if (direct) return direct
  const path = request.path.split("/").filter(Boolean)
  const marker = endpoint.includes("pricing-templates/:id")
    ? "pricing-templates"
    : endpoint.includes("service-requests/:id")
      ? "service-requests"
      : endpoint.includes("request-inbox/:id")
        ? "request-inbox"
        : endpoint.includes("request-workflows/:id")
          ? "request-workflows"
          : endpoint.includes("administrative-requests/:id")
            ? "administrative-requests"
            : endpoint.includes("workload/assignment/:id")
              ? "assignment"
              : endpoint.includes("services/:id")
                ? "services"
                : null
  if (!marker) return undefined
  const markerIndex = path.indexOf(marker)
  return markerIndex < 0 ? undefined : recordId(path[markerIndex + 1])
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function dateValue(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) ? auditDate(date) : null
}

function requestLabel(record: {
  id: string
  referenceNumber: string | null
  service: { name: string }
}) {
  return `${record.service.name} (${record.referenceNumber ?? record.id})`
}

/** Builds only endpoint-specific, allowlisted context; request bodies are never copied. */
export async function resolveIncidentAuditContext(
  prisma: PrismaClient,
  request: Request,
  endpoint: string | undefined,
  action: string | undefined,
): Promise<ServiceIncidentAuditContext> {
  if (!endpoint) return {}
  const body = bodyOf(request)
  const routeId = routeRecordId(request, endpoint)

  if (endpoint.includes("/api/services/pricing-templates/:id") && routeId) {
    const template = await prisma.pricingTemplate.findUnique({
      where: { id: routeId },
      select: {
        name: true,
        pricingModel: true,
        currency: true,
        amount: true,
        billingInterval: true,
        isPublic: true,
      },
    })
    const deleting = endpoint.startsWith("DELETE ")
    return {
      subjectId: routeId,
      targetType: "Pricing template",
      targetLabel: template?.name,
      changes: deleting
        ? [{ field: "Record", before: "Existing", after: "Deleted" }]
        : [
            {
              field: "Name",
              before: auditText(template?.name),
              after:
                typeof body.name === "string" ? auditText(body.name) : null,
            },
            {
              field: "Pricing model",
              before: auditCode(template?.pricingModel),
              after:
                typeof body.pricingModel === "string"
                  ? auditCode(body.pricingModel)
                  : null,
            },
            {
              field: "Amount",
              before: template?.amount
                ? `${template.currency} ${template.amount.toString()}`
                : "Custom quote",
              after: numberValue(body.amount),
            },
            {
              field: "Billing interval",
              before: auditCode(template?.billingInterval),
              after:
                typeof body.billingInterval === "string"
                  ? auditCode(body.billingInterval)
                  : null,
            },
            {
              field: "Public pricing",
              before: template?.isPublic ?? null,
              after: booleanValue(body.isPublic),
            },
          ],
    }
  }

  if (endpoint.startsWith("POST /api/services"))
    return {
      targetType: "Service offering",
      targetLabel:
        typeof body.name === "string"
          ? (auditText(body.name) ?? undefined)
          : undefined,
      changes: [{ field: "Record", before: null, after: "Creation attempted" }],
    }

  if (endpoint.includes("/api/services/:id") && routeId) {
    const service = await prisma.service.findUnique({
      where: { id: routeId },
      select: {
        name: true,
        isActive: true,
        requiresConsultation: true,
        requiresAgreement: true,
        requiresPayment: true,
        requiresQuotationApproval: true,
      },
    })
    const changes: ServiceLogChange[] = endpoint.endsWith("/status")
      ? [
          {
            field: "Availability",
            before:
              service === null
                ? null
                : service.isActive
                  ? "Available"
                  : "Unavailable",
            after:
              booleanValue(body.isActive) === null
                ? null
                : body.isActive
                  ? "Available"
                  : "Unavailable",
          },
        ]
      : endpoint.startsWith("DELETE ")
        ? [{ field: "Record", before: "Existing", after: "Deleted" }]
        : endpoint.startsWith("PUT ")
          ? [
              {
                field: "Name",
                before: auditText(service?.name),
                after:
                  typeof body.name === "string" ? auditText(body.name) : null,
              },
              {
                field: "Availability",
                before:
                  service === null
                    ? null
                    : service.isActive
                      ? "Available"
                      : "Unavailable",
                after:
                  booleanValue(body.isActive) === null
                    ? null
                    : body.isActive
                      ? "Available"
                      : "Unavailable",
              },
              {
                field: "Consultation required",
                before: service?.requiresConsultation ?? null,
                after: booleanValue(body.requiresConsultation),
              },
              {
                field: "Agreement required",
                before: service?.requiresAgreement ?? null,
                after: booleanValue(body.requiresAgreement),
              },
              {
                field: "Payment required",
                before: service?.requiresPayment ?? null,
                after: booleanValue(body.requiresPayment),
              },
              {
                field: "Quotation approval required",
                before: service?.requiresQuotationApproval ?? null,
                after: booleanValue(body.requiresQuotationApproval),
              },
            ]
          : []
    return {
      subjectId: routeId,
      targetType: "Service offering",
      targetLabel: service?.name,
      changes,
    }
  }

  if (endpoint === "PUT /api/workload/capacity") {
    const employeeId = recordId(body.employeeId)
    if (!employeeId) return { targetType: "Staff capacity" }
    const week = typeof body.week === "string" ? body.week : undefined
    const [employee, capacity] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { fullName: true },
      }),
      week
        ? prisma.workloadCapacity.findUnique({
            where: { employeeId_week: { employeeId, week } },
            select: { scheduledHours: true, timeOffHours: true },
          })
        : null,
    ])
    return {
      subjectId: employeeId,
      targetType: "Staff capacity",
      targetLabel: employee?.fullName,
      changes: [
        {
          field: "Week",
          before: capacity ? (week ?? null) : null,
          after: week ?? null,
        },
        {
          field: "Scheduled hours",
          before: capacity?.scheduledHours ?? null,
          after: numberValue(body.scheduledHours),
        },
        {
          field: "Time off hours",
          before: capacity?.timeOffHours ?? null,
          after: numberValue(body.timeOffHours),
        },
      ],
    }
  }

  if (endpoint === "PUT /api/workload/assignment") {
    const projectId = recordId(body.projectId)
    const employeeId = recordId(body.employeeId)
    if (!projectId)
      return { targetType: "Project staffing", subjectId: employeeId }
    const [project, employee, current] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, requestId: true },
      }),
      employeeId
        ? prisma.employee.findUnique({
            where: { id: employeeId },
            select: { fullName: true },
          })
        : null,
      employeeId
        ? prisma.projectStaff.findUnique({
            where: { projectId_employeeId: { projectId, employeeId } },
            select: {
              weeklyHours: true,
              allocationStart: true,
              allocationEnd: true,
            },
          })
        : null,
    ])
    return {
      subjectId: projectId,
      requestId: project?.requestId ?? undefined,
      targetType: "Project staffing",
      targetLabel: project?.name,
      changes: [
        {
          field: "Staff member",
          before: current ? (employee?.fullName ?? null) : null,
          after: employee?.fullName ?? employeeId ?? null,
        },
        {
          field: "Weekly hours",
          before: current?.weeklyHours ?? null,
          after: numberValue(body.weeklyHours),
        },
        {
          field: "Allocation start",
          before: auditDate(current?.allocationStart),
          after: typeof body.week === "string" ? body.week : null,
        },
        {
          field: "Allocation end",
          before: auditDate(current?.allocationEnd),
          after: dateValue(body.endDate),
        },
      ],
    }
  }

  if (endpoint === "DELETE /api/workload/assignment/:id" && routeId) {
    const assignment = await prisma.projectStaff.findUnique({
      where: { id: routeId },
      select: {
        projectId: true,
        weeklyHours: true,
        allocationStart: true,
        allocationEnd: true,
        employee: { select: { fullName: true } },
        project: { select: { name: true, requestId: true } },
      },
    })
    return {
      subjectId: assignment?.projectId ?? routeId,
      requestId: assignment?.project.requestId ?? undefined,
      targetType: "Project staffing",
      targetLabel: assignment?.project.name,
      changes: assignment
        ? [
            {
              field: "Staff member",
              before: assignment.employee.fullName,
              after: null,
            },
            {
              field: "Weekly hours",
              before: assignment.weeklyHours,
              after: null,
            },
            {
              field: "Allocation start",
              before: auditDate(assignment.allocationStart),
              after: null,
            },
            {
              field: "Allocation end",
              before: auditDate(assignment.allocationEnd),
              after: null,
            },
          ]
        : undefined,
    }
  }

  const requestId =
    endpoint.includes("/api/request-workflows/:id") ||
    endpoint.includes("/api/request-inbox/:id") ||
    endpoint.includes("/api/client/service-requests/:id") ||
    endpoint.includes("/api/service-requests/:id") ||
    endpoint.includes("/api/administrative-requests/:id")
      ? routeId
      : undefined
  if (requestId) {
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        service: { select: { name: true } },
        workflow: { select: { state: true } },
      },
    })
    const changes: ServiceLogChange[] = action
      ? [
          {
            field: "Workflow action",
            before: null,
            after: auditCode(action),
          },
        ]
      : endpoint.includes("/cancel")
        ? [
            {
              field: "Status",
              before: auditCode(serviceRequest?.status),
              after: "Cancelled",
            },
          ]
        : endpoint.includes("/accept")
          ? [
              {
                field: "Status",
                before: auditCode(serviceRequest?.status),
                after: "Under Review",
              },
            ]
          : endpoint.endsWith("/files")
            ? [
                {
                  field: "File upload",
                  before: "Not completed",
                  after: "Completed",
                },
              ]
            : []
    return {
      subjectId: requestId,
      requestId,
      targetType: "Service request",
      targetLabel: serviceRequest ? requestLabel(serviceRequest) : undefined,
      changes,
    }
  }

  if (
    endpoint === "POST /api/service-requests" ||
    endpoint === "POST /api/client/service-requests"
  ) {
    const serviceId = recordId(body.serviceId)
    const service = serviceId
      ? await prisma.service.findUnique({
          where: { id: serviceId },
          select: { name: true },
        })
      : null
    return {
      subjectId: serviceId,
      targetType: "Service request",
      targetLabel: service?.name,
      changes: [{ field: "Status", before: null, after: "Submitted" }],
    }
  }

  return {}
}
