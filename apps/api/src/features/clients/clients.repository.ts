import { Role, type Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import type { ClientFilters } from "./clients.schema.js"

const clientSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export const clientsRepository = {
  async list(filters: ClientFilters) {
    const prisma = getPrisma()!
    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      accountDeletedAt: null,
      ...(filters.status ? { isActive: filters.status === "ACTIVE" } : {}),
      ...(filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [filters.sortBy]: filters.sortOrder },
      { id: "asc" },
    ]
    const pageSize = 20
    const [clients, total] = await prisma.$transaction(
      [
        prisma.user.findMany({
          where,
          select: clientSelect,
          orderBy,
          skip: (filters.page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    )
    return { clients, total, page: filters.page, pageSize }
  },
  async detail(id: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(
      async (tx) => {
        const client = await tx.user.findFirst({
          where: { id, role: Role.USER, accountDeletedAt: null },
          select: clientSelect,
        })
        if (!client) return null
        const [serviceRequestCount, projectCount] = await Promise.all([
          tx.serviceRequest.count({ where: { clientId: id } }),
          tx.project.count({ where: { clientId: id } }),
        ])
        return { client, serviceRequestCount, projectCount }
      },
      { isolationLevel: "RepeatableRead" },
    )
  },
  async serviceRequests(id: string, page: number) {
    const prisma = getPrisma()!
    return prisma.$transaction(
      async (tx) => {
        const client = await tx.user.findFirst({
          where: { id, role: Role.USER, accountDeletedAt: null },
          select: { id: true },
        })
        if (!client) return null
        const where = { clientId: id }
        const [serviceRequests, total] = await Promise.all([
          tx.serviceRequest.findMany({
            where,
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              service: { select: { id: true, name: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip: (page - 1) * 10,
            take: 10,
          }),
          tx.serviceRequest.count({ where }),
        ])
        return { serviceRequests, total, page, pageSize: 10 }
      },
      { isolationLevel: "RepeatableRead" },
    )
  },
  async projects(id: string, page: number) {
    const prisma = getPrisma()!
    return prisma.$transaction(
      async (tx) => {
        const client = await tx.user.findFirst({
          where: { id, role: Role.USER, accountDeletedAt: null },
          select: { id: true },
        })
        if (!client) return null
        const where = { clientId: id }
        const [projects, total] = await Promise.all([
          tx.project.findMany({
            where,
            select: {
              id: true,
              name: true,
              status: true,
              startDate: true,
              createdAt: true,
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            skip: (page - 1) * 10,
            take: 10,
          }),
          tx.project.count({ where }),
        ])
        return { projects, total, page, pageSize: 10 }
      },
      { isolationLevel: "RepeatableRead" },
    )
  },
}
