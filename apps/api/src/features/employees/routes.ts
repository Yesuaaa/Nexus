import { Router } from "express"
import {
  EmployeeStatus,
  EmploymentType,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { Permission } from "../auth/permissions.js"
import { hashPassword, validPassword } from "../auth/password.js"
import {
  createEmployee,
  EmployeeError,
  employeeInclude,
  getEmployeeStatusOptions,
  updateEmployee,
} from "./service.js"
import { validateEmployeeInput } from "./validation.js"

export const employeesRouter = Router()
employeesRouter.use(requireAuth)

function validEmployeeAccountPassword(value: unknown): value is string {
  return (
    validPassword(value) &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

function isUniqueConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined
}

function sendError(response: import("express").Response, error: unknown) {
  if (error instanceof EmployeeError) {
    response.status(error.status).json({ error: error.message })
    return true
  }
  if (isUniqueConflict(error)) {
    response
      .status(409)
      .json({ error: "Employee ID or account email already exists" })
    return true
  }
  const code = prismaErrorCode(error)
  if (code === "P2003") {
    response.status(400).json({
      error: "A selected department or team no longer exists",
    })
    return true
  }
  if (code === "P2025" || code === "P2034") {
    response.status(409).json({ error: "Employee changed; refresh and retry" })
    return true
  }
  return false
}

function withoutEmployeeAccountDetails<
  T extends {
    userId: string | null
    user?: { isActive: boolean; accountDeletedAt: Date | null } | null
  },
>(record: T) {
  const { userId: omittedUserId, user: omittedUser, ...employee } = record
  const hasAccount = Boolean(omittedUserId && !omittedUser?.accountDeletedAt)
  const accountIsActive = hasAccount ? (omittedUser?.isActive ?? false) : null
  return { ...employee, hasAccount, accountIsActive }
}

async function createStaffAccount(
  tx: Prisma.TransactionClient,
  employee: {
    email: string | null
    fullName: string
    contactNumber: string | null
    position: string | null
    departmentId: string | null
    teamId: string | null
  },
  passwordHash: string,
) {
  if (!employee.email) {
    throw new EmployeeError(400, "Email is required to create an account")
  }
  return tx.user.create({
    data: {
      email: employee.email,
      fullName: employee.fullName,
      contactNumber: employee.contactNumber,
      position: employee.position,
      passwordHash,
      role: Role.STAFF,
      isActive: true,
      departmentId: employee.departmentId,
      teamId: employee.teamId,
    },
  })
}

function parsePage(value: unknown) {
  if (value === undefined) return 1
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 && page <= 1_000_000
    ? page
    : null
}

function parseQueryString(value: unknown) {
  if (value === undefined) return ""
  return typeof value === "string" ? value.trim() : null
}

// GET /api/employees - Search and paginate employee records.
employeesRouter.get(
  "/",
  requirePermission(Permission.EMPLOYEES_READ),
  async (request, response) => {
    const search = parseQueryString(request.query.search)
    const departmentId = parseQueryString(request.query.departmentId)
    const employmentType = parseQueryString(request.query.employmentType)
    const status = parseQueryString(request.query.status)
    const page = parsePage(request.query.page)

    if (
      search === null ||
      departmentId === null ||
      employmentType === null ||
      status === null ||
      search.length > 100 ||
      departmentId.length > 80 ||
      page === null ||
      (employmentType &&
        !Object.values(EmploymentType).includes(
          employmentType as EmploymentType,
        )) ||
      (status &&
        !Object.values(EmployeeStatus).includes(status as EmployeeStatus))
    ) {
      return response.status(400).json({ error: "Invalid employee filters" })
    }

    const where: Prisma.EmployeeWhereInput = {
      ...(departmentId ? { departmentId } : {}),
      ...(employmentType
        ? { employmentType: employmentType as EmploymentType }
        : {}),
      ...(status ? { status: status as EmployeeStatus } : {}),
      ...(search
        ? {
            OR: [
              { employeeId: { contains: search, mode: "insensitive" } },
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { contactNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const prisma = getPrisma()!
    const pageSize = 20
    const [employees, total] = await prisma.$transaction([
      prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ fullName: "asc" }, { employeeId: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ])
    return response.json({
      employees: employees.map(withoutEmployeeAccountDetails),
      total,
      page,
      pageSize,
    })
  },
)

// POST /api/employees - Create an employee record.
employeesRouter.post(
  "/",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    const password = request.body?.password
    if (!validEmployeeAccountPassword(password)) {
      return response.status(400).json({
        error:
          "Password must be at least 12 characters with uppercase, lowercase, number, and special character",
      })
    }
    try {
      const passwordHash = await hashPassword(password)
      const employee = await getPrisma()!.$transaction(async (tx) => {
        const account = await createStaffAccount(
          tx,
          {
            email: parsed.value.email ?? null,
            fullName: parsed.value.fullName ?? "",
            contactNumber: parsed.value.contactNumber ?? null,
            position: parsed.value.position ?? null,
            departmentId: parsed.value.departmentId ?? null,
            teamId: parsed.value.teamId ?? null,
          },
          passwordHash,
        )
        return createEmployee(tx, { ...parsed.value, userId: account.id })
      })
      return response
        .status(201)
        .json({ employee: withoutEmployeeAccountDetails(employee) })
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)

// GET /api/employees/:id/status-options - Read department head handoff choices.
employeesRouter.get(
  "/:id/status-options",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    try {
      const options = await getPrisma()!.$transaction((tx) =>
        getEmployeeStatusOptions(tx, String(request.params.id)),
      )
      return response.json(options)
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)

// GET /api/employees/:id - Read a single employee record.
employeesRouter.get(
  "/:id",
  requirePermission(Permission.EMPLOYEES_READ),
  async (request, response) => {
    const employee = await getPrisma()!.employee.findUnique({
      where: { id: String(request.params.id) },
      include: employeeInclude,
    })
    if (!employee)
      return response.status(404).json({ error: "Employee not found" })
    return response.json({ employee: withoutEmployeeAccountDetails(employee) })
  },
)

// PUT /api/employees/:id - Partially update employee data.
employeesRouter.put(
  "/:id",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, true)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    const password = request.body?.password
    if (password !== undefined && !validEmployeeAccountPassword(password)) {
      return response.status(400).json({
        error:
          "Password must be at least 12 characters with uppercase, lowercase, number, and special character",
      })
    }
    try {
      const passwordHash =
        typeof password === "string" ? await hashPassword(password) : null
      const employee = await getPrisma()!.$transaction(async (tx) => {
        const updated = await updateEmployee(
          tx,
          String(request.params.id),
          parsed.value,
        )
        if (!passwordHash) return updated
        if (updated.userId && !updated.user?.accountDeletedAt) {
          throw new EmployeeError(409, "Employee already has a portal account")
        }
        if (updated.userId) {
          await tx.user.update({
            where: { id: updated.userId },
            data: {
              passwordHash,
              isActive: true,
              accountDeletedAt: null,
              email: updated.email!,
              fullName: updated.fullName,
              contactNumber: updated.contactNumber,
              position: updated.position,
              departmentId: updated.departmentId,
              teamId: updated.teamId,
            },
          })
          return tx.employee.findUniqueOrThrow({
            where: { id: updated.id },
            include: employeeInclude,
          })
        }
        const account = await createStaffAccount(tx, updated, passwordHash)
        return updateEmployee(tx, updated.id, { userId: account.id })
      })
      return response.json({
        employee: withoutEmployeeAccountDetails(employee),
      })
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)

employeesRouter.patch(
  "/:id/account/status",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    if (request.body?.isActive !== false) {
      return response
        .status(400)
        .json({ error: "Only account deactivation is supported here" })
    }
    const actor = request.auth!.user
    try {
      await getPrisma()!.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: String(request.params.id) },
          select: {
            user: { select: { id: true, role: true, accountDeletedAt: true } },
          },
        })
        if (!employee) throw new EmployeeError(404, "Employee not found")
        if (!employee.user || employee.user.accountDeletedAt) {
          throw new EmployeeError(409, "Employee has no login account")
        }
        if (employee.user.id === actor.id) {
          throw new EmployeeError(
            403,
            "You cannot deactivate your own login account",
          )
        }
        if (
          employee.user.role === Role.ADMIN ||
          employee.user.role === Role.SUPERADMIN
        ) {
          throw new EmployeeError(
            403,
            "Admin accounts must be managed from Account Management",
          )
        }
        await tx.user.update({
          where: { id: employee.user.id },
          data: { isActive: false },
        })
        await tx.session.deleteMany({ where: { userId: employee.user.id } })
      })
      return response.status(204).send()
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)

employeesRouter.delete(
  "/:id/account",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const actor = request.auth!.user
    try {
      await getPrisma()!.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({
          where: { id: String(request.params.id) },
          select: {
            user: {
              select: {
                id: true,
                role: true,
                isActive: true,
                accountDeletedAt: true,
              },
            },
          },
        })
        if (!employee) throw new EmployeeError(404, "Employee not found")
        if (!employee.user || employee.user.accountDeletedAt) {
          throw new EmployeeError(409, "Employee has no login account")
        }
        if (employee.user.id === actor.id) {
          throw new EmployeeError(
            403,
            "You cannot delete your own login account",
          )
        }
        if (
          employee.user.role === Role.ADMIN ||
          employee.user.role === Role.SUPERADMIN
        ) {
          throw new EmployeeError(
            403,
            "Admin accounts must be managed from Account Management",
          )
        }
        if (employee.user.isActive) {
          throw new EmployeeError(
            409,
            "Deactivate this login account before deleting it",
          )
        }
        await tx.user.update({
          where: { id: employee.user.id },
          data: { accountDeletedAt: new Date() },
        })
      })
      return response.status(204).send()
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)
