import { Router } from "express"
import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { hasPermission, Permission } from "../auth/permissions.js"
import { hashPassword, validPassword } from "../auth/password.js"
import { normalizedEmail } from "../auth/validation.js"
import { publicUser } from "./public-user.js"
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
    const sort =
      typeof request.query.sort === "string" ? request.query.sort : "createdAt"
    const direction =
      typeof request.query.direction === "string"
        ? request.query.direction
        : "desc"
    const page = Number(request.query.page ?? 1)
    const pageSize = 20
    const sortableColumns = [
      "member",
      "role",
      "status",
      "department",
      "createdAt",
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
              : [{ createdAt: sortDirection }, { id: sortDirection }]
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
        orderBy,
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
      const user = await prisma.user.create({
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
          passwordHash: await hashPassword(password),
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
    if (!hasPermission(actor.role, Permission.ACCOUNTS_ASSIGN_PRIVILEGED)) {
      const result = await prisma.user.updateMany({
        where: { id: target.id, role: { in: [Role.STAFF, Role.USER] } },
        data: { role: role as Role },
      })
      if (result.count === 0)
        return response
          .status(409)
          .json({ error: "Role changed; refresh and retry" })
    } else {
      await prisma.user.update({
        where: { id: target.id },
        data: { role: role as Role },
      })
    }
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    })
    return response.json({ user: publicUser(updated) })
  },
)
