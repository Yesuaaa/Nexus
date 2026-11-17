import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { HttpError } from "../../shared/http-error.js"
import { paginate } from "../../shared/query/pagination.js"
import {
  deleteAccountPermanently,
  moveAccountToTrash,
  restoreAccountFromTrash,
  setAccountActive,
} from "./account-lifecycle.js"
import { publicUserInclude } from "./users.dto.js"

export interface CreateUserInput {
  email: string
  fullName: string
  contactNumber: string | null
  position: string | null
  passwordHash: string
  role: Role
  departmentId: string | null
  teamId: string | null
}

export const usersRepository = {
  async changePasswordAndRevokeSessions(
    id: string,
    currentPasswordHash: string,
    passwordHash: string,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: {
          id,
          passwordHash: currentPasswordHash,
          accountDeletedAt: null,
        },
        data: { passwordHash },
      })
      if (updated.count === 0) return false
      await transaction.session.deleteMany({ where: { userId: id } })
      return true
    })
  },

  // Lifecycle writes are conditional on the state the service just checked,
  // so a concurrent change returns null/false (a 409) instead of applying.
  async updateStatus(
    id: string,
    currentRole: Role,
    currentIsActive: boolean,
    nextIsActive: boolean,
  ) {
    return getPrisma()!.$transaction(async (tx) => {
      const updated = await setAccountActive(tx, id, nextIsActive, {
        role: currentRole,
        isActive: currentIsActive,
      })
      if (!updated) return null
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: publicUserInclude,
      })
    })
  },

  async softDeleteInactiveUser(id: string, role: Role) {
    return getPrisma()!.$transaction((tx) =>
      moveAccountToTrash(tx, id, { guard: { role, isActive: false } }),
    )
  },

  async restoreUser(id: string, role: Role, accountDeletedAt: Date) {
    return getPrisma()!.$transaction(async (tx) => {
      const restored = await restoreAccountFromTrash(tx, id, {
        role,
        isActive: false,
        accountDeletedAt,
      })
      if (!restored) return null
      return tx.user.findUniqueOrThrow({
        where: { id },
        include: publicUserInclude,
      })
    })
  },

  async permanentlyDeleteUser(id: string, role: Role) {
    return deleteAccountPermanently(getPrisma()!, id, {
      guard: { role, isActive: false, accountDeletedAt: { not: null } },
      linkedMessage:
        "This account has related records and cannot be permanently deleted. Keep it in Trash to preserve its history.",
    })
  },

  async findDepartmentById(id: string) {
    const prisma = getPrisma()!
    return prisma.department.findUnique({ where: { id } })
  },

  async findTeamById(id: string) {
    const prisma = getPrisma()!
    return prisma.team.findUnique({ where: { id } })
  },

  async findUsersPage(
    where: Prisma.UserWhereInput,
    orderBy: Prisma.UserOrderByWithRelationInput[],
    page: number,
  ) {
    return paginate(page, {
      rows: (db, window) =>
        db.user.findMany({
          where,
          include: publicUserInclude,
          orderBy,
          ...window,
        }),
      count: (db) => db.user.count({ where }),
    })
  },

  async createUserWithSync(
    data: CreateUserInput,
    syncEmployee: (
      tx: Prisma.TransactionClient,
      userId: string,
    ) => Promise<unknown>,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          fullName: data.fullName,
          contactNumber: data.contactNumber,
          position: data.position,
          passwordHash: data.passwordHash,
          role: data.role,
          departmentId: data.departmentId,
          teamId: data.teamId,
        },
        include: publicUserInclude,
      })
      await syncEmployee(tx, created.id)
      return created
    })
  },

  async changeUserRoleWithSync(
    targetId: string,
    currentRole: Role,
    nextRole: Role,
    syncEmployee: (
      tx: Prisma.TransactionClient,
      userId: string,
    ) => Promise<unknown>,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      await lockRows(tx, "User", targetId)
      // Department heads and team leads must stay STAFF; otherwise their
      // department's requests become unroutable and the roster goes stale.
      if (nextRole !== Role.STAFF) {
        const department = await tx.department.findFirst({
          where: { headId: targetId },
          select: { name: true },
        })
        if (department) {
          throw new HttpError(
            409,
            `Reassign the ${department.name} head role before changing this account's role`,
          )
        }
        const team = await tx.team.findFirst({
          where: { leadId: targetId },
          select: { name: true },
        })
        if (team) {
          throw new HttpError(
            409,
            `Reassign the ${team.name} team lead role before changing this account's role`,
          )
        }
      }
      if (
        nextRole === Role.SUPERADMIN &&
        (await tx.employee.findUnique({ where: { userId: targetId } }))
      ) {
        throw new HttpError(
          409,
          "Unlink the employee record before promoting this account to Superadmin",
        )
      }
      const result = await tx.user.updateMany({
        where: { id: targetId, role: currentRole },
        data: { role: nextRole },
      })
      if (result.count === 0) {
        throw new HttpError(409, "Role changed; refresh and retry")
      }
      await syncEmployee(tx, targetId)
      return tx.user.findUniqueOrThrow({
        where: { id: targetId },
        include: publicUserInclude,
      })
    })
  },
}
