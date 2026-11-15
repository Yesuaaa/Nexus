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
import type { ManagementOperation } from "../../shared/management-history.js"
import { writeAccountManagementChange } from "../users/account-management-history.js"

const clientSelect = {
  id: true,
  fullName: true,
  email: true,
  contactNumber: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export const clientsRepository = {
  async delete(id: string, operation: ManagementOperation) {
    const prisma = getPrisma()!
    return prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findFirst({
          where: { id, role: Role.USER, accountDeletedAt: null },
          select: { id: true, isActive: true, accountDeletedAt: true },
        })
        if (!target) return "missing"
        if (
          (await tx.serviceRequest.count({ where: { clientId: id } })) ||
          (await tx.project.count({ where: { clientId: id } }))
        )
          return "linked"
        // Clients have no separate deactivate step: one write disables the
        // login, moves it to Trash and revokes its sessions.
        const moved = await moveAccountToTrash(tx, id, { deactivate: true })
        if (!moved) return "missing"
        const after = await tx.user.findUniqueOrThrow({
          where: { id },
          select: { isActive: true, accountDeletedAt: true },
        })
        const statusChanged = target.isActive !== after.isActive
        await writeAccountManagementChange(tx, operation, {
          subjectAccountId: id,
          action: "ARCHIVED",
          origin: "CLIENT_MANAGEMENT",
          changedFields: [
            "accountDeletedAt",
            ...(statusChanged ? ["isActive" as const] : []),
          ],
          changes: {
            accountDeletedAt: {
              before: target.accountDeletedAt?.toISOString() ?? null,
              after: after.accountDeletedAt!.toISOString(),
            },
            ...(statusChanged
              ? { isActive: { before: target.isActive, after: after.isActive } }
              : {}),
            sessionsRevoked: true,
          },
        })
        return "deleted"
      },
      { isolationLevel: "Serializable" },
    )
  },
  async save(
    input: NonNullable<ReturnType<typeof parseClientInput>>,
    id: string | null,
    operation: ManagementOperation,
  ) {
    const prisma = getPrisma()!
    const creating = id === null
    const { password, ...profile } = input
    const passwordHash = creating ? await hashPassword(password!) : undefined
    return prisma.$transaction(
      async (tx) => {
        const before = creating
          ? null
          : await tx.user.findFirst({
              where: {
                id: id!,
                role: Role.USER,
                accountDeletedAt: null,
              },
              select: clientSelect,
            })
        if (!creating && !before) return null
        const duplicate = await tx.user.findFirst({
          where: {
            email: { equals: profile.email, mode: "insensitive" },
            ...(creating ? {} : { id: { not: id! } }),
          },
          select: { id: true },
        })
        if (duplicate) fail(409, "An account with this email already exists.")
        if (creating) {
          const created = await tx.user.create({
            data: {
              ...profile,
              role: Role.USER,
              passwordHash: passwordHash!,
            },
            select: { ...clientSelect, role: true },
          })
          const { role, ...client } = created
          await writeAccountManagementChange(tx, operation, {
            subjectAccountId: client.id,
            action: "CREATED",
            origin: "CLIENT_MANAGEMENT",
            changedFields: [
              "role",
              "isActive",
              "fullName",
              "email",
              "contactNumber",
            ],
            changes: {
              role: { before: null, after: role },
              isActive: { before: null, after: client.isActive },
            },
          })
          return client
        }
        const updated = await tx.user.update({
          where: { id: id! },
          data: profile,
          select: clientSelect,
        })
        if (!profile.isActive) await revokeSessions(tx, updated.id)
        const changedFields = (
          ["fullName", "email", "contactNumber", "isActive"] as const
        ).filter((field) => before![field] !== updated[field])
        if (changedFields.length || !profile.isActive) {
          await writeAccountManagementChange(tx, operation, {
            subjectAccountId: updated.id,
            action: "PROFILE_UPDATED",
            origin: "CLIENT_MANAGEMENT",
            changedFields,
            changes: {
              ...(before!.isActive !== updated.isActive
                ? {
                    isActive: {
                      before: before!.isActive,
                      after: updated.isActive,
                    },
                  }
                : {}),
              ...(!profile.isActive ? { sessionsRevoked: true } : {}),
            },
          })
        }
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
