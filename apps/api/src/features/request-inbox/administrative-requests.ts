import { Router } from "express"
import { Prisma, ServiceRequestStatus } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { readTransaction } from "../../lib/database-read.js"
import { fail } from "../../shared/http-error.js"
import { insensitive, paginate } from "../../shared/query/pagination.js"
import { recordIdParam } from "../../shared/validation.js"
import { requireAuth } from "../auth/auth.middleware.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../auth/auth.capabilities.js"
import { requestSelect } from "./request-inbox.service.js"
import { parseInboxFilters } from "./request-inbox.schema.js"
import { administrativeWorkflowSnapshot } from "../request-workflow/administrative-workflow.service.js"

// Deliberately exclude conversations, files, financial values and submitted free text.
const selection = {
  ...requestSelect,
  acceptedBy: { select: { id: true, fullName: true } },
  acceptedDepartment: {
    select: {
      id: true,
      name: true,
      head: { select: { id: true, fullName: true } },
    },
  },
  service: {
    select: {
      id: true,
      name: true,
      departments: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  },
  workflow: { select: { state: true, updatedAt: true } },
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      staff: {
        select: {
          isTeamLead: true,
          employee: { select: { id: true, fullName: true, position: true } },
        },
        orderBy: { employeeId: "asc" },
      },
    },
  },
} satisfies Prisma.ServiceRequestSelect

function inspectable(
  request: Prisma.ServiceRequestGetPayload<{ select: typeof selection }>,
) {
  return {
    ...request,
    capabilities: {
      read: true,
      accept: false,
      reject: false,
      staff: false,
      approveQuotation: false,
      verifyPayment: false,
      mutateWorkflow: false,
      participate: false,
      downloadFiles: false,
    },
  }
}

export const administrativeRequestsRouter = Router()
administrativeRequestsRouter.use(requireAuth, (request, _response, next) => {
  const actor = request.auth!.user
  if (
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.MODULE_ACCESS,
    ) ||
    !hasAdministrativeCapability(
      actor,
      AdministrativeCapability.ORGANIZATION_READ,
    )
  )
    fail(403, "Organization-wide service request read access is required")
  next()
})
administrativeRequestsRouter.get("/", async (request, response) => {
  const filters = parseInboxFilters({ ...request.query, view: "all" })
  const { status = "", departmentId = "" } = request.query
  if (
    !filters ||
    typeof status !== "string" ||
    (status &&
      !Object.values(ServiceRequestStatus).includes(
        status as ServiceRequestStatus,
      )) ||
    typeof departmentId !== "string" ||
    departmentId.length > 100
  )
    fail(400, "Invalid administrative request filters")
  const where: Prisma.ServiceRequestWhereInput = {
    ...(status ? { status: status as ServiceRequestStatus } : {}),
    ...insensitive<Prisma.ServiceRequestWhereInput>(filters.search, [
      "id",
      "title",
      "referenceNumber",
      "packageName",
      (text) => ({ service: { name: text } }),
      (text) => ({ client: { fullName: text } }),
    ]),
  }
  // AND keeps routing filters independent from the search helper's OR clauses.
  const routing: Prisma.ServiceRequestWhereInput = departmentId
    ? {
        OR: [
          { acceptedDepartmentId: departmentId },
          {
            acceptedDepartmentId: null,
            service: { departments: { some: { id: departmentId } } },
          },
        ],
      }
    : {}
  const scopedWhere: Prisma.ServiceRequestWhereInput = { AND: [where, routing] }
  const order: Prisma.ServiceRequestOrderByWithRelationInput =
    filters.sortBy === "service"
      ? { service: { name: filters.sortDir } }
      : filters.sortBy === "client"
        ? { client: { fullName: { sort: filters.sortDir, nulls: "last" } } }
        : filters.sortBy === "reference"
          ? { referenceNumber: { sort: filters.sortDir, nulls: "last" } }
          : { [filters.sortBy]: filters.sortDir }
  const { rows, ...pagination } = await paginate(filters.page, {
    rows: (db, window) =>
      db.serviceRequest.findMany({
        where: scopedWhere,
        select: selection,
        ...window,
        orderBy: [order, { id: "asc" }],
      }),
    count: (db) => db.serviceRequest.count({ where: scopedWhere }),
  })
  const departments = await getPrisma()!.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  response.json({
    serviceRequests: rows.map(inspectable),
    departments,
    ...pagination,
  })
})
administrativeRequestsRouter.param("id", recordIdParam("Invalid request id"))
administrativeRequestsRouter.get("/:id", async (request, response) => {
  const serviceRequest = await readTransaction(async (tx) => {
    const id = String(request.params.id)
    const record = await tx.serviceRequest.findUnique({
      where: { id },
      select: selection,
    })
    if (!record) fail(404, "Service request not found")
    return {
      ...inspectable(record),
      workflowInspection: await administrativeWorkflowSnapshot(tx, id),
    }
  })
  response.json({ serviceRequest })
})
