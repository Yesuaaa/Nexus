import { hashPassword } from "../auth/auth.password.js"
import {
  moveAccountToTrash,
  revokeSessions,
} from "../users/account-lifecycle.js"
import type { parseClientInput } from "./clients.schema.js"
import { Role, type Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { insensitive, paginate } from "../../shared/query/pagination.js"
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
        // Clients have no separate deactivate step: one write disables the
        // login, moves it to Trash and revokes its sessions.
        await moveAccountToTrash(tx, id, { deactivate: true })
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
        if (duplicate) fail(409, "An account with this email already exists.")
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
        if (!profile.isActive) await revokeSessions(tx, updated.id)
        return updated
      },
      { isolationLevel: "Serializable" },
    )
  },
  async list(filters: ClientFilters) {
    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      accountDeletedAt: null,
      ...(filters.status ? { isActive: filters.status === "ACTIVE" } : {}),
      ...insensitive<Prisma.UserWhereInput>(filters.search, [
        "fullName",
        "email",
      ]),
    }
    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [filters.sortBy]: filters.sortOrder },
      { id: "asc" },
    ]
    const { rows: clients, ...page } = await paginate(filters.page, {
      rows: (db, window) =>
        db.user.findMany({ where, select: clientSelect, orderBy, ...window }),
      count: (db) => db.user.count({ where }),
    })
    return { clients, ...page }
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
        const { rows: serviceRequests, ...result } = await paginate(
          page,
          {
            rows: (db, window) =>
              db.serviceRequest.findMany({
                where,
                select: {
                  id: true,
                  title: true,
                  status: true,
                  createdAt: true,
                  service: { select: { id: true, name: true } },
                },
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                ...window,
              }),
            count: (db) => db.serviceRequest.count({ where }),
          },
          { tx },
        )
        return { serviceRequests, ...result }
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
        const { rows: projects, ...result } = await paginate(
          page,
          {
            rows: (db, window) =>
              db.project.findMany({
                where,
                select: {
                  id: true,
                  name: true,
                  status: true,
                  startDate: true,
                  createdAt: true,
                },
                orderBy: [{ createdAt: "desc" }, { id: "asc" }],
                ...window,
              }),
            count: (db) => db.project.count({ where }),
          },
          { tx },
        )
        return { projects, ...result }
      },
      { isolationLevel: "RepeatableRead" },
    )
  },
}
