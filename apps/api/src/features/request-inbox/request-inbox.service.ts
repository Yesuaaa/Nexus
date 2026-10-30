import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { ServiceRequestsError } from "../service-requests/service-requests.service.js"
import type { InboxFilters } from "./request-inbox.schema.js"

const requestSelect = {
  id: true,
  title: true,
  status: true,
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
    service: {
      departments: {
        some: {
          headId: userId,
          head: { role: "STAFF", isActive: true, accountDeletedAt: null },
        },
      },
    },
  }
}

export async function listInbox(userId: string, filters: InboxFilters) {
  const department = await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(
    async (tx) => {
      // Both initial labels are supported, even when only one exists in this database.
      const labels = await tx.$queryRaw<{ label: string }[]>`
      SELECT e.enumlabel AS label FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ServiceRequestStatus' AND n.nspname = current_schema()
    `
      const statuses =
        filters.view === "pending"
          ? (["PENDING", "SUBMITTED"] as const)
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
  await requireDepartmentHead(userId)
  return getPrisma()!.$transaction(async (tx) => {
    const where = { id, ...departmentScope(userId) }
    const request = await tx.serviceRequest.findFirst({
      where,
      select: { status: true },
    })
    if (!request) throw new ServiceRequestsError(404, "Request not found")
    if (request.status !== "PENDING" && request.status !== "SUBMITTED")
      throw new ServiceRequestsError(
        409,
        "This request is no longer awaiting acceptance. Refresh the inbox.",
      )
    // The conditional update allows exactly one head to accept a shared booking.
    // Recheck current head assignment and service routing at the write itself.
    const updated = await tx.serviceRequest.updateMany({
      where: { ...where, status: request.status },
      data: { status: "UNDER_REVIEW" },
    })
    if (updated.count !== 1)
      throw new ServiceRequestsError(
        409,
        "This request changed. Refresh the inbox and try again.",
      )
    return tx.serviceRequest.findUniqueOrThrow({
      where: { id },
      select: requestSelect,
    })
  })
}
