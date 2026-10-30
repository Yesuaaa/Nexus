import { Prisma, Role, type User } from "../../generated/prisma/client.js"
import {
  isForeignKeyViolation,
  isUniqueConflict,
  isWriteConflict,
} from "../../lib/errors.js"
import { hashPassword, validPassword } from "../auth/auth.password.js"
import { normalizedEmail } from "../auth/auth.schema.js"
import {
  EmployeeError,
  syncEmployeeForUser,
} from "../employees/employees.service.js"
import { publicUser } from "./users.dto.js"
import {
  canAssignRole,
  canChangeAccountStatus,
  canCreateRole,
} from "./users.policy.js"
import {
  UserPromotionError,
  UserRoleConflictError,
  usersRepository,
} from "./users.repository.js"

export class UsersError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "UsersError"
  }
}

export const usersService = {
  async changePassword(actor: User, targetId: string, newPassword: unknown) {
    if (actor.role !== Role.SUPERADMIN) {
      throw new UsersError(403, "Only Superadmins can change account passwords")
    }
    if (actor.id === targetId) {
      throw new UsersError(
        403,
        "You cannot change your own password through account management",
      )
    }
    if (
      !validPassword(newPassword) ||
      !/[A-Z]/.test(newPassword) ||
      !/[a-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword) ||
      !/[^A-Za-z0-9]/.test(newPassword)
    ) {
      throw new UsersError(
        400,
        "Use at least 12 characters, including uppercase, lowercase, a number and a special character, up to 1,024 bytes",
      )
    }
    const target = await usersRepository.findById(targetId)
    if (!target || target.accountDeletedAt) {
      throw new UsersError(404, "User not found")
    }
    const updated = await usersRepository.changePasswordAndRevokeSessions(
      target.id,
      target.passwordHash,
      await hashPassword(newPassword),
    )
    if (!updated) {
      throw new UsersError(409, "Account changed; refresh and retry")
    }
  },

  async changeStatus(actor: User, targetId: string, isActive: unknown) {
    if (typeof isActive !== "boolean") {
      throw new UsersError(400, "Provide an active status")
    }
    if (actor.id === targetId) {
      throw new UsersError(403, "You cannot change your own account status")
    }
    const target = await usersRepository.findById(targetId)
    if (!target || target.accountDeletedAt) {
      throw new UsersError(404, "User not found")
    }
    if (!canChangeAccountStatus(actor.role, target.role)) {
      throw new UsersError(403, "You cannot change this account's status")
    }

    const user = await usersRepository.updateStatus(
      targetId,
      target.role,
      target.isActive,
      isActive,
    )
    if (!user) {
      throw new UsersError(409, "Account changed; refresh and retry")
    }
    return { user: publicUser(user) }
  },

  async softDeleteUser(actor: User, targetId: string) {
    if (actor.id === targetId) {
      throw new UsersError(403, "You cannot move your own account to trash")
    }
    const target = await usersRepository.findById(targetId)
    if (!target || target.accountDeletedAt) {
      throw new UsersError(404, "User not found")
    }
    if (!canChangeAccountStatus(actor.role, target.role)) {
      throw new UsersError(403, "You cannot move this account to trash")
    }
    if (target.isActive) {
      throw new UsersError(
        409,
        "Deactivate the account before moving it to trash",
      )
    }
    const deleted = await usersRepository.softDeleteInactiveUser(
      targetId,
      target.role,
    )
    if (deleted.count === 0) {
      throw new UsersError(409, "Account changed; refresh and retry")
    }
    return { message: "Account moved to trash" }
  },

  async restoreUser(actor: User, targetId: string) {
    if (actor.id === targetId) {
      throw new UsersError(403, "You cannot restore your own account")
    }
    const target = await usersRepository.findById(targetId)
    if (!target) {
      throw new UsersError(404, "User not found")
    }
    if (!canChangeAccountStatus(actor.role, target.role)) {
      throw new UsersError(403, "You cannot restore this account")
    }
    if (!target.accountDeletedAt || target.isActive) {
      throw new UsersError(
        409,
        "Only inactive accounts in Trash can be restored",
      )
    }
    const user = await usersRepository.restoreUser(
      target.id,
      target.role,
      target.accountDeletedAt,
    )
    if (!user) {
      throw new UsersError(409, "Account changed; refresh and retry")
    }
    return { user: publicUser(user) }
  },

  async permanentlyDeleteUser(actor: User, targetId: string) {
    if (actor.id === targetId) {
      throw new UsersError(
        403,
        "You cannot permanently delete your own account",
      )
    }
    const target = await usersRepository.findById(targetId)
    if (!target) {
      throw new UsersError(404, "User not found")
    }
    if (!canChangeAccountStatus(actor.role, target.role)) {
      throw new UsersError(403, "You cannot permanently delete this account")
    }
    if (!target.accountDeletedAt) {
      throw new UsersError(
        409,
        "Move the account to trash before deleting it permanently",
      )
    }
    try {
      const deleted = await usersRepository.permanentlyDeleteUser(
        targetId,
        target.role,
      )
      if (deleted.count === 0) {
        throw new UsersError(409, "Account changed; refresh and retry")
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new UsersError(
          409,
          "This account has related records and cannot be permanently deleted. Keep it in Trash to preserve its history.",
        )
      }
      throw error
    }
    return { message: "Account permanently deleted" }
  },

  async listUsers(query: {
    search?: unknown
    role?: unknown
    sort?: unknown
    direction?: unknown
    page?: unknown
    deleted?: unknown
  }) {
    const search = typeof query.search === "string" ? query.search.trim() : ""
    const role = typeof query.role === "string" ? query.role : ""
    const sort = typeof query.sort === "string" ? query.sort : "createdAt"
    const direction =
      typeof query.direction === "string" ? query.direction : "desc"
    const page = Number(query.page ?? 1)
    const deleted = query.deleted === "true"
    const pageSize = 10
    const sortableColumns = [
      "member",
      "role",
      "status",
      "department",
      "createdAt",
      "deletedAt",
    ]
    if (
      search.length > 100 ||
      (role && !Object.values(Role).includes(role as Role)) ||
      !sortableColumns.includes(sort) ||
      !["asc", "desc"].includes(direction) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1_000_000
    ) {
      throw new UsersError(400, "Invalid account filters")
    }

    const where: Prisma.UserWhereInput = {
      accountDeletedAt: deleted ? { not: null } : null,
      ...(role ? { role: role as Role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" as const } },
              { fullName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const sortDirection = direction as Prisma.SortOrder
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      sort === "member"
        ? [
            { fullName: sortDirection },
            { email: sortDirection },
            { id: sortDirection },
          ]
        : sort === "role"
          ? [{ role: sortDirection }, { fullName: "asc" }, { id: "asc" }]
          : sort === "status"
            ? [{ isActive: sortDirection }, { fullName: "asc" }, { id: "asc" }]
            : sort === "department"
              ? [
                  { department: { name: sortDirection } },
                  { fullName: "asc" },
                  { id: "asc" },
                ]
              : sort === "deletedAt"
                ? [{ accountDeletedAt: sortDirection }, { id: sortDirection }]
                : [{ createdAt: sortDirection }, { id: sortDirection }]

    const [users, total] = await usersRepository.findUsersWithCount(
      where,
      orderBy,
      (page - 1) * pageSize,
      pageSize,
    )

    return {
      users: users.map(publicUser),
      total,
      page,
      pageSize,
    }
  },

  async createUser(
    actor: User,
    input: {
      email?: unknown
      password?: unknown
      role?: unknown
      fullName?: unknown
      contactNumber?: unknown
      position?: unknown
      departmentId?: unknown
      teamId?: unknown
    },
  ) {
    const email = normalizedEmail(input.email)
    const password = input.password
    const role = input.role
    const fullName = input.fullName
    const contactNumber = input.contactNumber
    const position = input.position
    const departmentId = input.departmentId
    const teamId = input.teamId

    if (
      !email ||
      !validPassword(password) ||
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      throw new UsersError(
        400,
        "Provide a valid email, role, and password of at least 12 characters",
      )
    }

    if (typeof position === "string" && position.trim()) {
      const lower = position.trim().toLowerCase()
      if (lower === "dept head" || lower === "department head") {
        throw new UsersError(
          400,
          "Cannot assign 'Department Head' as a job title during account creation. Assign the Department Head in Department Management.",
        )
      }
    }
    if (!canCreateRole(actor.role, role as Role)) {
      throw new UsersError(403, "You cannot create an account with that role")
    }
    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 100
    ) {
      throw new UsersError(400, "Provide a full name of 2 to 100 characters")
    }
    if (
      contactNumber !== undefined &&
      contactNumber !== null &&
      contactNumber !== "" &&
      (typeof contactNumber !== "string" ||
        !/^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber.trim()))
    ) {
      throw new UsersError(400, "Provide a valid contact number")
    }

    if (departmentId) {
      const dept = await usersRepository.findDepartmentById(
        String(departmentId),
      )
      if (!dept) {
        throw new UsersError(400, "Department not found")
      }
    }
    if (teamId) {
      const team = await usersRepository.findTeamById(String(teamId))
      if (!team) {
        throw new UsersError(400, "Team not found")
      }
      if (departmentId && team.departmentId !== departmentId) {
        throw new UsersError(
          400,
          "Team does not belong to the selected department",
        )
      }
    }

    try {
      const passwordHash = await hashPassword(password as string)
      const user = await usersRepository.createUserWithSync(
        {
          email,
          fullName: fullName.trim(),
          contactNumber:
            typeof contactNumber === "string" && contactNumber.trim()
              ? contactNumber.trim()
              : null,
          position:
            typeof position === "string" && position.trim()
              ? position.trim()
              : null,
          passwordHash,
          role: role as Role,
          departmentId: departmentId ? String(departmentId) : null,
          teamId: teamId ? String(teamId) : null,
        },
        syncEmployeeForUser,
      )
      return { user: publicUser(user) }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new UsersError(409, "Email is already registered")
      }
      throw error
    }
  },

  async changeRole(actor: User, targetId: string, role: unknown) {
    if (
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      throw new UsersError(400, "Invalid role")
    }
    if (actor.id === targetId) {
      throw new UsersError(403, "You cannot change your own role")
    }
    const target = await usersRepository.findById(targetId)
    if (!target || target.accountDeletedAt) {
      throw new UsersError(404, "User not found")
    }
    if (!canAssignRole(actor.role, target.role, role as Role)) {
      throw new UsersError(403, "You cannot assign that role")
    }

    try {
      const updated = await usersRepository.changeUserRoleWithSync(
        target.id,
        target.role,
        role as Role,
        syncEmployeeForUser,
      )
      return { user: publicUser(updated) }
    } catch (error) {
      if (error instanceof UserPromotionError) {
        throw new UsersError(409, error.message)
      }
      if (error instanceof UserRoleConflictError) {
        throw new UsersError(409, error.message)
      }
      if (error instanceof EmployeeError) {
        throw new UsersError(error.status, error.message)
      }
      if (isWriteConflict(error)) {
        throw new UsersError(409, "Account changed; refresh and retry")
      }
      throw error
    }
  },
}
