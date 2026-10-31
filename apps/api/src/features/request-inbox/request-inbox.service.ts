import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import { initializeWorkflow } from "../request-workflow/workflow.access.js"
import type { InboxFilters } from "./request-inbox.schema.js"

const requestSelect = {
  id: true,
  referenceNumber: true,
  title: true,
  status: true,
  acceptedDepartmentId: true,
  acceptedAt: true,
  packageName: true,
  expectedTimeline: true,
  preferredSpecialistName: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true } },
  client: { select: { fullName: true, email: true, contactNumber: true } },
} as const satisfies Prisma.ServiceRequestSelect

export async function requireDepartmentHead(userId: string) {
  const department = await getPrisma()!.department.findFirst({
    where: {
      headId: userId,
      head: { role: "STAFF", isActive: true, accountDeletedAt: null },
    },
    select: { id: true, name: true },
  })
  if (!department)
    throw new ServiceRequestsError(
      403,
      "Only current department heads can access the request inbox",
    )
  return department
}

function departmentScope(userId: string): Prisma.ServiceRequestWhereInput {
  return {
    AND: [
      {
        OR: [
          {
            service: {
              departments: {
                some: {
                  headId: userId,
                  head: {
                    role: "STAFF",
                    isActive: true,
                    accountDeletedAt: null,
                  },
                },
              },
            },
          },
          { acceptedDepartment: { headId: userId } },
        ],
      },
    ],
  }
}

export async function listInbox(userId: string, filters: InboxFilters) {
  const department = await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(
    async (tx) => {
      // Avoid querying enum labels that aren't present on older databases.
      const labels = await tx.$queryRaw<{ label: string }[]>`
      SELECT e.enumlabel AS label FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ServiceRequestStatus' AND n.nspname = current_schema()
    `
      const statuses =
        filters.view === "pending"
          ? (["SUBMITTED"] as const)
          : (["UNDER_REVIEW"] as const)
      const where: Prisma.ServiceRequestWhereInput = {
        ...departmentScope(userId),
        status: {
          in: statuses.filter((status) =>
            labels.some(({ label }) => label === status),
          ),
        },
        ...(filters.search
          ? {
              OR: [
                { id: { contains: filters.search, mode: "insensitive" } },
                {
                  referenceNumber: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  service: {
                    name: { contains: filters.search, mode: "insensitive" },
                  },
                },
                {
                  packageName: {
                    contains: filters.search,
                    mode: "insensitive",
                  },
                },
                {
                  client: {
                    fullName: { contains: filters.search, mode: "insensitive" },
                  },
                },
                {
                  client: {
                    email: { contains: filters.search, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      }
      const serviceRequests = await tx.serviceRequest.findMany({
        where,
        select: requestSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 10,
        skip: (filters.page - 1) * 10,
      })
      const total = await tx.serviceRequest.count({ where })
      return {
        department,
        serviceRequests,
        total,
        page: filters.page,
        pageSize: 10,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function getInboxRequest(userId: string, id: string) {
  await requireDepartmentHead(userId)
  const request = await getPrisma()!.serviceRequest.findFirst({
    where: { id, ...departmentScope(userId) },
    select: {
      ...requestSelect,
      projectGoals: true,
      projectRequirements: true,
      additionalDetails: true,
    },
  })
  if (!request) throw new ServiceRequestsError(404, "Request not found")
  return request
}

export async function acceptInboxRequest(userId: string, id: string) {
  const department = await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(async (tx) => {
    const where = { id, ...departmentScope(userId) }
    const request = await tx.serviceRequest.findFirst({
      where,
      select: { status: true, acceptedDepartmentId: true },
    })
    if (!request) throw new ServiceRequestsError(404, "Request not found")
    if (
      request.acceptedDepartmentId ||
      (request.status !== "SUBMITTED" && request.status !== "UNDER_REVIEW")
    )
      throw new ServiceRequestsError(
        409,
        "This request is no longer awaiting acceptance. Refresh the inbox.",
      )
    // The conditional update allows exactly one head to accept a shared booking.
    // Recheck current head assignment and service routing at the write itself.
    const updated = await tx.serviceRequest.updateMany({
      where: {
        id,
        status: request.status,
        acceptedDepartmentId: null,
        service: {
          departments: {
            some: {
              id: department.id,
              headId: userId,
              head: { role: "STAFF", isActive: true, accountDeletedAt: null },
            },
          },
        },
      },
      data: {
        status: "UNDER_REVIEW",
        acceptedDepartmentId: department.id,
        acceptedById: userId,
        acceptedAt: new Date(),
      },
    })
    if (updated.count !== 1)
      throw new ServiceRequestsError(
        409,
        "This request changed. Refresh the inbox and try again.",
      )
    await initializeWorkflow(tx, id, userId)
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id },
      select: requestSelect,
    })
  })
}
