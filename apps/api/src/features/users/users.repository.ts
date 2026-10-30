import { Prisma, Role, type User } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

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
  async findById(id: string): Promise<User | null> {
    const prisma = getPrisma()!
    return prisma.user.findUnique({ where: { id } })
  },

  async updateStatus(
    id: string,
    currentRole: Role,
    currentIsActive: boolean,
    nextIsActive: boolean,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.updateMany({
        where: { id, role: currentRole, isActive: currentIsActive },
        data: { isActive: nextIsActive },
      })
      if (updated.count === 0) return null
      if (!nextIsActive) {
        await transaction.session.deleteMany({ where: { userId: id } })
      }
      return transaction.user.findUniqueOrThrow({
        where: { id },
        include: {
          department: {
            select: { id: true, name: true, code: true, color: true },
          },
          team: { select: { id: true, name: true } },
        },
      })
    })
  },

  async softDeleteInactiveUser(id: string, role: Role) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (transaction) => {
      const deleted = await transaction.user.updateMany({
        where: {
          id,
          role,
          isActive: false,
          accountDeletedAt: null,
        },
        data: { accountDeletedAt: new Date() },
      })
      if (deleted.count > 0) {
        await transaction.session.deleteMany({ where: { userId: id } })
      }
      return deleted
    })
  },

  async permanentlyDeleteUser(id: string, role: Role) {
    const prisma = getPrisma()!
    return prisma.user.deleteMany({
      where: {
        id,
        role,
        isActive: false,
        accountDeletedAt: { not: null },
      },
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

  async findUsersWithCount(
    where: Prisma.UserWhereInput,
    orderBy: Prisma.UserOrderByWithRelationInput[],
    skip: number,
    take: number,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          department: {
            select: { id: true, name: true, code: true, color: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ])
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
        include: {
          department: {
            select: { id: true, name: true, code: true, color: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
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
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${targetId} FOR UPDATE`,
      )
      if (
        nextRole === Role.SUPERADMIN &&
        (await tx.employee.findUnique({ where: { userId: targetId } }))
      ) {
        throw new UserPromotionError(
          "Unlink the employee record before promoting this account to Superadmin",
        )
      }
      const result = await tx.user.updateMany({
        where: { id: targetId, role: currentRole },
        data: { role: nextRole },
      })
      if (result.count === 0) {
        throw new UserRoleConflictError("Role changed; refresh and retry")
      }
      await syncEmployee(tx, targetId)
      return tx.user.findUniqueOrThrow({
        where: { id: targetId },
        include: {
          department: {
            select: { id: true, name: true, code: true, color: true },
          },
          team: { select: { id: true, name: true } },
        },
      })
    })
  },
}

export class UserPromotionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserPromotionError"
  }
}

export class UserRoleConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserRoleConflictError"
  }
}
