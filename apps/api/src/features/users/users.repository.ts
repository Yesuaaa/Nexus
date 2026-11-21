import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import { HttpError } from "../../shared/http-error.js"
import { paginate } from "../../shared/query/pagination.js"
import {
  deleteAccountPermanently,
  moveAccountToTrash,
  restoreAccountFromTrash,
  setAccountActive,
} from "./account-lifecycle.js"
import { publicUserInclude } from "./users.dto.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { writeAccountManagementChange } from "./account-management-history.js"
import {
  syncAccountWorkforce,
  readAccountDeletionWorkforce,
  writeAccountDeletionWorkforce,
} from "./account-workforce-history.js"

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
    operation: ManagementOperation,
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
      await writeAccountManagementChange(transaction, operation, {
        subjectAccountId: id,
        action: "PASSWORD_RESET",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: [],
        changes: { sessionsRevoked: true },
      })
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
    operation: ManagementOperation,
  ) {
    return getPrisma()!.$transaction(async (tx) => {
      const updated = await setAccountActive(tx, id, nextIsActive, {
        role: currentRole,
        isActive: currentIsActive,
        accountDeletedAt: null,
      },operation.actorAccountId)
      if (!updated) return null
      const user = await tx.user.findUniqueOrThrow({
        where: { id },
        include: publicUserInclude,
      })
      if (currentIsActive !== user.isActive || !nextIsActive) {
        await writeAccountManagementChange(tx, operation, {
          subjectAccountId: id,
          action: "STATUS_CHANGED",
          origin: "ACCOUNT_MANAGEMENT",
          changedFields: currentIsActive !== user.isActive ? ["isActive"] : [],
          changes: {
            ...(currentIsActive !== user.isActive
              ? { isActive: { before: currentIsActive, after: user.isActive } }
              : {}),
            sessionsRevoked: !nextIsActive,
          },
        })
      }
      return user
    })
  },

  async softDeleteInactiveUser(
    id: string,
    role: Role,
    operation: ManagementOperation,
  ) {
    return getPrisma()!.$transaction(async (tx) => {
      const moved = await moveAccountToTrash(tx, id, {
        guard: { role, isActive: false },
      })
      if (!moved) return false
      const after = await tx.user.findUniqueOrThrow({
        where: { id },
        select: { accountDeletedAt: true },
      })
      await writeAccountManagementChange(tx, operation, {
        subjectAccountId: id,
        action: "ARCHIVED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["accountDeletedAt"],
        changes: {
          accountDeletedAt: {
            before: null,
            after: after.accountDeletedAt!.toISOString(),
          },
          sessionsRevoked: true,
        },
      })
      return true
    })
  },

  async restoreUser(
    id: string,
    role: Role,
    accountDeletedAt: Date,
    operation: ManagementOperation,
  ) {
    return getPrisma()!.$transaction(async (tx) => {
      const restored = await restoreAccountFromTrash(tx, id, {
        role,
        isActive: false,
        accountDeletedAt,
      })
      if (!restored) return null
      const user = await tx.user.findUniqueOrThrow({
        where: { id },
        include: publicUserInclude,
      })
      await writeAccountManagementChange(tx, operation, {
        subjectAccountId: id,
        action: "RESTORED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["accountDeletedAt"],
        changes: {
          accountDeletedAt: {
            before: accountDeletedAt.toISOString(),
            after: user.accountDeletedAt?.toISOString() ?? null,
          },
          sessionsRevoked: true,
        },
      })
      return user
    })
  },

  async permanentlyDeleteUser(
    id: string,
    role: Role,
    operation: ManagementOperation,
  ) {
    return getPrisma()!.$transaction(
      async (tx) => {
        const workforce = await readAccountDeletionWorkforce(tx, id)
        const deleted = await deleteAccountPermanently(tx, id, {
          guard: { role, isActive: false, accountDeletedAt: { not: null } },
          linkedMessage:
            "This account has related records and cannot be permanently deleted. Keep it in Trash to preserve its history.",
        })
        if (!deleted) return false
        await writeAccountManagementChange(tx, operation, {
          subjectAccountId: id,
          action: "DELETED",
          origin: "ACCOUNT_MANAGEMENT",
          changedFields: [],
          changes: {},
        })
        await writeAccountDeletionWorkforce(tx, operation, workforce)
        return true
      },
      { isolationLevel: "Serializable" },
    )
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
    operation: ManagementOperation,
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
      await writeAccountManagementChange(tx, operation, {
        subjectAccountId: created.id,
        action: "CREATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: [
          "role",
          "isActive",
          "fullName",
          "email",
          "contactNumber",
        ],
        changes: {
          role: { before: null, after: created.role },
          isActive: { before: null, after: created.isActive },
        },
      })
      await syncAccountWorkforce(tx, operation, created.id, syncEmployee, true)
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
    operation: ManagementOperation,
    profile?: { fullName: string; email: string; contactNumber: string | null },
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      await lockRowsReturning(tx, "Employee", targetId, "update", "userId")
      await lockRows(tx, "User", targetId)
      const before = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
      })
      // Department heads and team leads must stay STAFF; otherwise their
      // department's requests become unroutable and the roster goes stale.
      if (nextRole !== currentRole && nextRole !== Role.STAFF) {
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
        nextRole !== currentRole &&
        (await tx.employee.findUnique({ where: { userId: targetId } }))
      ) {
        throw new HttpError(
          409,
          "Unlink the employee record before promoting this account to Superadmin",
        )
      }
      const result = await tx.user.updateMany({
        where: { id: targetId, role: currentRole, accountDeletedAt: null },
        data: { role: nextRole, ...profile },
      })
      if (result.count === 0) {
        throw new HttpError(409, "Role changed; refresh and retry")
      }
      const after = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
        select: { role: true },
      })
      if (currentRole !== after.role)
        await writeAccountManagementChange(tx, operation, {
          subjectAccountId: targetId,
          action: "ROLE_CHANGED",
          origin: "ACCOUNT_MANAGEMENT",
          changedFields: ["role"],
          changes: { role: { before: currentRole, after: after.role } },
        })
      if (profile) {
        const changedFields = (
          ["fullName", "email", "contactNumber"] as const
        ).filter((field) => before[field] !== profile[field])
        if (changedFields.length)
          await writeAccountManagementChange(tx, operation, {
            subjectAccountId: targetId,
            action: "PROFILE_UPDATED",
            origin: "ACCOUNT_MANAGEMENT",
            changedFields,
            changes: {},
          })
      }
      await syncAccountWorkforce(tx, operation, targetId, syncEmployee)
      return tx.user.findUniqueOrThrow({
        where: { id: targetId },
        include: publicUserInclude,
      })
    })
  },
}
