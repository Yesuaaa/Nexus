import { hashPassword } from "../auth/auth.password.js"
import type { parseClientInput } from "./clients.schema.js"
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
  async delete(id: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findFirst({
          where: { id, role: Role.USER, accountDeletedAt: null },
          select: { id: true },
        })
        if (!target) return "missing"
        if (
          (await tx.serviceRequest.count({ where: { clientId: id } })) ||
          (await tx.project.count({ where: { clientId: id } }))
        )
          return "linked"
        await tx.user.update({
          where: { id },
          data: { isActive: false, accountDeletedAt: new Date() },
        })
        await tx.session.deleteMany({ where: { userId: id } })
        return "deleted"
      },
      { isolationLevel: "Serializable" },
    )
  },
  async save(
    input: NonNullable<ReturnType<typeof parseClientInput>>,
    id: string | null,
  ) {
    const prisma = getPrisma()!
    const creating = id === null
    const { password, ...profile } = input
    const passwordHash = creating ? await hashPassword(password!) : undefined
    return prisma.$transaction(
      async (tx) => {
        if (!creating) {
          const target = await tx.user.findFirst({
            where: {
              id: id!,
              role: Role.USER,
              accountDeletedAt: null,
            },
          })
          if (!target) return null
        }
        const duplicate = await tx.user.findFirst({
          where: {
            email: { equals: profile.email, mode: "insensitive" },
            ...(creating ? {} : { id: { not: id! } }),
          },
          select: { id: true },
        })
        if (duplicate) throw new Error("DUPLICATE_EMAIL")
        if (creating)
          return tx.user.create({
            data: {
              ...profile,
              role: Role.USER,
              passwordHash: passwordHash!,
            },
            select: clientSelect,
          })
        const updated = await tx.user.update({
          where: { id: id! },
          data: profile,
          select: clientSelect,
        })
        if (!profile.isActive)
          await tx.session.deleteMany({ where: { userId: updated.id } })
        return updated
      },
      { isolationLevel: "Serializable" },
    )
  },
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
    const pageSize = 10
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
          tx.project.count({
            where: {
              clientId: id,
              OR: [{ requestId: null }, { startDate: { not: null } }],
            },
          }),
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
        const where: Prisma.ProjectWhereInput = {
          clientId: id,
          OR: [{ requestId: null }, { startDate: { not: null } }],
        }
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
