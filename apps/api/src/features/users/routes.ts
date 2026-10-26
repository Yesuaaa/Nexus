import { Router } from "express"
import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { Permission } from "../auth/permissions.js"
import { hashPassword, validPassword } from "../auth/password.js"
import { normalizedEmail } from "../auth/validation.js"
import { publicUser } from "./public-user.js"
import { EmployeeError, syncEmployeeForUser } from "../employees/service.js"
import {
  canAssignRole,
  canChangeAccountStatus,
  canCreateRole,
} from "./role-policy.js"

export const usersRouter = Router()
usersRouter.use(requireAuth)

usersRouter.patch(
  "/:id/status",
  requirePermission(Permission.ACCOUNTS_STATUS_BASIC),
  async (request, response) => {
    const actor = request.auth!.user
    const id = String(request.params.id)
    const isActive = request.body?.isActive
    if (typeof isActive !== "boolean") {
      return response.status(400).json({ error: "Provide an active status" })
    }
    if (actor.id === id) {
      return response
        .status(403)
        .json({ error: "You cannot change your own account status" })
    }
    const prisma = getPrisma()!
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) return response.status(404).json({ error: "User not found" })
    if (!canChangeAccountStatus(actor.role, target.role)) {
      return response
        .status(403)
        .json({ error: "You cannot change this account's status" })
    }

    const user = await prisma.$transaction(async (transaction) => {
      // Check the role again in the write to prevent concurrent promotion
      // from allowing an Admin to deactivate a privileged account.
      const updated = await transaction.user.updateMany({
        where: { id, role: target.role, isActive: target.isActive },
        data: { isActive },
      })
      if (updated.count === 0) return null
      if (!isActive) {
        await transaction.session.deleteMany({ where: { userId: id } })
      }
      return transaction.user.findUniqueOrThrow({
        where: { id },
        include: {
          department: { select: { id: true, name: true, code: true } },
          team: { select: { id: true, name: true } },
        },
      })
    })
    if (!user) {
      return response
        .status(409)
        .json({ error: "Account changed; refresh and retry" })
    }
    return response.json({ user: publicUser(user) })
  },
)

usersRouter.get(
  "/",
  requirePermission(Permission.ACCOUNTS_READ),
  async (request, response) => {
    const search =
      typeof request.query.search === "string"
        ? request.query.search.trim()
        : ""
    const role =
      typeof request.query.role === "string" ? request.query.role : ""
    const page = Number(request.query.page ?? 1)
    const pageSize = 20
    if (
      search.length > 100 ||
      (role && !Object.values(Role).includes(role as Role)) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1_000_000
    ) {
      return response.status(400).json({ error: "Invalid account filters" })
    }
    const where = {
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
    const prisma = getPrisma()!
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])
    response.json({ users: users.map(publicUser), total, page, pageSize })
  },
)

usersRouter.post(
  "/",
  requirePermission(Permission.ACCOUNTS_CREATE_BASIC),
  async (request, response) => {
    const actor = request.auth!.user
    const email = normalizedEmail(request.body?.email)
    const password = request.body?.password
    const role = request.body?.role
    const fullName = request.body?.fullName
    const contactNumber = request.body?.contactNumber
    const position = request.body?.position
    const departmentId = request.body?.departmentId
    const teamId = request.body?.teamId

    if (
      !email ||
      !validPassword(password) ||
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      return response.status(400).json({
        error:
          "Provide a valid email, role, and password of at least 12 characters",
      })
    }

    if (typeof position === "string" && position.trim()) {
      const lower = position.trim().toLowerCase()
      if (lower === "dept head" || lower === "department head") {
        return response.status(400).json({
          error:
            "Cannot assign 'Department Head' as a job title during account creation. Assign the Department Head in Department Management.",
        })
      }
    }
    if (!canCreateRole(actor.role, role as Role)) {
      return response
        .status(403)
        .json({ error: "You cannot create an account with that role" })
    }
    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 2 ||
      fullName.trim().length > 100
    ) {
      return response
        .status(400)
        .json({ error: "Provide a full name of 2 to 100 characters" })
    }
    if (
      contactNumber !== undefined &&
      contactNumber !== null &&
      contactNumber !== "" &&
      (typeof contactNumber !== "string" ||
        !/^\+?[0-9][0-9\s-]{6,19}$/.test(contactNumber.trim()))
    ) {
      return response
        .status(400)
        .json({ error: "Provide a valid contact number" })
    }
    const prisma = getPrisma()!
    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: String(departmentId) },
      })
      if (!dept) {
        return response.status(400).json({ error: "Department not found" })
      }
    }
    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: String(teamId) },
      })
      if (!team) {
        return response.status(400).json({ error: "Team not found" })
      }
      if (departmentId && team.departmentId !== departmentId) {
        return response
          .status(400)
          .json({ error: "Team does not belong to the selected department" })
      }
    }
    try {
      const passwordHash = await hashPassword(password)
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
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
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
            team: {
              select: { id: true, name: true },
            },
          },
        })
        await syncEmployeeForUser(tx, created.id)
        return created
      })
      return response.status(201).json({ user: publicUser(user) })
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return response
          .status(409)
          .json({ error: "Email is already registered" })
      }
      throw error
    }
  },
)

usersRouter.patch(
  "/:id/role",
  requirePermission(Permission.ACCOUNTS_ASSIGN_BASIC),
  async (request, response) => {
    const actor = request.auth!.user
    const role = request.body?.role
    if (
      typeof role !== "string" ||
      !Object.values(Role).includes(role as Role)
    ) {
      return response.status(400).json({ error: "Invalid role" })
    }
    if (actor.id === request.params.id) {
      return response
        .status(403)
        .json({ error: "You cannot change your own role" })
    }
    const prisma = getPrisma()!
    const target = await prisma.user.findUnique({
      where: { id: String(request.params.id) },
    })
    if (!target) return response.status(404).json({ error: "User not found" })
    if (!canAssignRole(actor.role, target.role, role as Role)) {
      return response.status(403).json({ error: "You cannot assign that role" })
    }
    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${target.id} FOR UPDATE`,
        )
        if (
          role === Role.SUPERADMIN &&
          (await tx.employee.findUnique({ where: { userId: target.id } }))
        ) {
          throw new EmployeeError(
            409,
            "Unlink the employee record before promoting this account to Superadmin",
          )
        }
        const result = await tx.user.updateMany({
          where: { id: target.id, role: target.role },
          data: { role: role as Role },
        })
        if (result.count === 0)
          throw new EmployeeError(409, "Role changed; refresh and retry")
        await syncEmployeeForUser(tx, target.id)
        return tx.user.findUniqueOrThrow({
          where: { id: target.id },
          include: {
            department: { select: { id: true, name: true, code: true } },
            team: { select: { id: true, name: true } },
          },
        })
      })
      return response.json({ user: publicUser(updated) })
    } catch (error) {
      if (error instanceof EmployeeError)
        return response.status(error.status).json({ error: error.message })
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        return response
          .status(409)
          .json({ error: "Account changed; refresh and retry" })
      }
      throw error
    }
  },
)
