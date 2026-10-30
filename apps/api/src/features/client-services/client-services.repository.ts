import type { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import type { ClientRequestFilters } from "./client-services.schema.js"

export const clientRequestSelect = {
  id: true,
  referenceNumber: true,
  title: true,
  description: true,
  status: true,
  packageName: true,
  preferredSpecialistName: true,
  projectGoals: true,
  projectRequirements: true,
  expectedTimeline: true,
  additionalDetails: true,
  pricingModel: true,
  quotedPrice: true,
  currency: true,
  billingInterval: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true } },
  package: { select: { id: true, name: true } },
  preferredSpecialist: { select: { id: true, fullName: true, position: true } },
} satisfies Prisma.ServiceRequestSelect

export const clientServicesRepository = {
  async findClientRequests(clientId: string, filters: ClientRequestFilters) {
    const { page, search, status, sortOrder } = filters
    const pageSize = 10
    const where: Prisma.ServiceRequestWhereInput = {
      clientId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { referenceNumber: { contains: search, mode: "insensitive" } },
              { service: { name: { contains: search, mode: "insensitive" } } },
              { packageName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const prisma = getPrisma()!
    const summaryQuery = prisma.serviceRequest.groupBy({
      by: ["status"],
      where: { clientId },
      orderBy: { status: "asc" },
      _count: { _all: true },
    })
    const [requests, total, groups] = await prisma.$transaction([
      prisma.serviceRequest.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: sortOrder }, { id: sortOrder }],
        select: clientRequestSelect,
      }),
      prisma.serviceRequest.count({ where }),
      summaryQuery,
    ])
    const summary = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const group of groups) {
      const count = group._count._all
      summary.total += count
      if (group.status === "SUBMITTED") summary.pending += count
      if (
        group.status === "UNDER_REVIEW" ||
        group.status === "AWAITING_CLIENT_INFO" ||
        group.status === "READY_FOR_QUOTATION"
      )
        summary.inProgress += count
      if (group.status === "CLOSED") summary.completed += count
      if (group.status === "CANCELLED") summary.cancelled = count
    }
    return { requests, total, page, pageSize, summary }
  },
}
