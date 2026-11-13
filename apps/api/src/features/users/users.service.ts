import { Prisma, Role, type User } from "../../generated/prisma/client.js"
import { isUniqueConflict, isWriteConflict } from "../../lib/errors.js"
import { assertStrongPassword } from "../../shared/password-policy.js"
import { insensitive, parsePage } from "../../shared/query/pagination.js"
import { isContactNumber, normalizedEmail } from "../../shared/validation.js"
import { hashPassword } from "../auth/auth.password.js"
import { isDepartmentHeadTitle } from "../departments/leadership.policy.js"
import { syncEmployeeForUser } from "../employees/employees.service.js"
import { publicUser } from "./users.dto.js"
import {
  accountForManagement,
  assertNotSelf,
  findManageableAccount,
} from "./account-lifecycle.js"
import { canAssignRole, canCreateRole } from "./users.policy.js"
import { usersRepository } from "./users.repository.js"
import { HttpError as UsersError } from "../../shared/http-error.js"

/** Feature-named alias of the shared `HttpError`. */
export { UsersError }

const CHANGED = "Account changed; refresh and retry"

export const usersService = {
  // Only Superadmins may reset another account's password.
  async changePassword(actor: User, targetId: string, newPassword: unknown) {
    if (actor.role !== Role.SUPERADMIN) {
      throw new UsersError(403, "Only Superadmins can change account passwords")
    }
    assertNotSelf(
      actor.id,
      targetId,
      "You cannot change your own password through account management",
    )
    assertStrongPassword(newPassword, (message) => new UsersError(400, message))
    const target = await findManageableAccount(actor.role, targetId, {
      permitted: () => true,
    })
    const updated = await usersRepository.changePasswordAndRevokeSessions(
      target.id,
      target.passwordHash,
      await hashPassword(newPassword),
    )
    if (!updated) throw new UsersError(409, CHANGED)
  },

  async changeStatus(actor: User, targetId: string, isActive: unknown) {
    if (typeof isActive !== "boolean") {
      throw new UsersError(400, "Provide an active status")
    }
    const target = await accountForManagement(actor, targetId, {
      self: "You cannot change your own account status",
      denied: "You cannot change this account's status",
    })
    const user = await usersRepository.updateStatus(
      targetId,
      target.role,
      target.isActive,
      isActive,
    )
    if (!user) throw new UsersError(409, CHANGED)
    return { user: publicUser(user) }
  },

  async softDeleteUser(actor: User, targetId: string) {
    const target = await accountForManagement(actor, targetId, {
      self: "You cannot move your own account to trash",
      denied: "You cannot move this account to trash",
    })
    if (target.isActive) {
      throw new UsersError(
        409,
        "Deactivate the account before moving it to trash",
      )
    }
    const moved = await usersRepository.softDeleteInactiveUser(
      targetId,
      target.role,
    )
    if (!moved) throw new UsersError(409, CHANGED)
    return { message: "Account moved to trash" }
  },

  async restoreUser(actor: User, targetId: string) {
    const target = await accountForManagement(actor, targetId, {
      self: "You cannot restore your own account",
      denied: "You cannot restore this account",
      includeTrashed: true,
    })
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
    if (!user) throw new UsersError(409, CHANGED)
    return { user: publicUser(user) }
  },

  async permanentlyDeleteUser(actor: User, targetId: string) {
    const target = await accountForManagement(actor, targetId, {
      self: "You cannot permanently delete your own account",
      denied: "You cannot permanently delete this account",
      includeTrashed: true,
    })
    if (!target.accountDeletedAt) {
      throw new UsersError(
        409,
        "Move the account to trash before deleting it permanently",
      )
    }
    const deleted = await usersRepository.permanentlyDeleteUser(
      targetId,
      target.role,
    )
    if (!deleted) throw new UsersError(409, CHANGED)
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
    const page = parsePage(query.page)
    const deleted = query.deleted === "true"
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
      page === null
    ) {
      throw new UsersError(400, "Invalid account filters")
    }

    const where: Prisma.UserWhereInput = {
      accountDeletedAt: deleted ? { not: null } : null,
      ...(role ? { role: role as Role } : {}),
      ...insensitive<Prisma.UserWhereInput>(search, ["email", "fullName"]),
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

    const { rows, ...result } = await usersRepository.findUsersPage(
      where,
      orderBy,
      page,
    )
    return { users: rows.map(publicUser), ...result }
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
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      throw new UsersError(400, "Provide a valid email and role")
    }
    assertStrongPassword(password, (message) => new UsersError(400, message))

    if (typeof position === "string" && isDepartmentHeadTitle(position)) {
      throw new UsersError(
        400,
        "Cannot assign 'Department Head' as a job title during account creation. Assign the Department Head in Department Management.",
      )
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
        !isContactNumber(contactNumber.trim()))
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
      const passwordHash = await hashPassword(password)
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
    const target = await accountForManagement(actor, targetId, {
      self: "You cannot change your own role",
      denied: "You cannot assign that role",
      permitted: (account) =>
        canAssignRole(actor.role, account.role, role as Role),
    })

    try {
      const updated = await usersRepository.changeUserRoleWithSync(
        target.id,
        target.role,
        role as Role,
        syncEmployeeForUser,
      )
      return { user: publicUser(updated) }
    } catch (error) {
      if (isWriteConflict(error)) throw new UsersError(409, CHANGED)
      throw error
    }
  },
}
