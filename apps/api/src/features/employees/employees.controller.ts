import { Router, type Response } from "express"
import {
  EmployeeStatus,
  EmploymentType,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueConflict,
  isWriteConflict,
} from "../../lib/errors.js"
import { parsePage, parseQueryString } from "../../shared/query-helpers.js"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { hashPassword } from "../auth/auth.password.js"
import { Permission } from "../auth/auth.permissions.js"
import { employeeInclude, employeesRepository } from "./employees.repository.js"
import { validateEmployeeInput } from "./employees.schema.js"
import {
  createEmployee,
  createStaffAccount,
  EmployeeError,
  getEmployeeStatusOptions,
  updateEmployee,
  validEmployeeAccountPassword,
  withoutEmployeeAccountDetails,
} from "./employees.service.js"

export const employeesRouter = Router()
employeesRouter.use(requireAuth)

function sendError(response: Response, error: unknown) {
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
  if (isForeignKeyViolation(error)) {
    response.status(400).json({
      error: "A selected department or team no longer exists",
    })
    return true
  }
  if (isRecordNotFound(error) || isWriteConflict(error)) {
    response.status(409).json({ error: "Employee changed; refresh and retry" })
    return true
  }
  return false
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

    const pageSize = 10
    const [employees, total] = await employeesRepository.findManyWithCount(
      where,
      [{ fullName: "asc" }, { employeeId: "asc" }, { id: "asc" }],
      (page - 1) * pageSize,
      pageSize,
    )

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
  async (request, response, next) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed) {
      return response.status(400).json({ error: parsed.error })
    }
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
      next(error)
    }
  },
)

// GET /api/employees/:id/status-options - Read department head handoff choices.
employeesRouter.get(
  "/:id/status-options",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
    try {
      const options = await getPrisma()!.$transaction((tx) =>
        getEmployeeStatusOptions(tx, String(request.params.id)),
      )
      return response.json(options)
    } catch (error) {
      if (sendError(response, error)) return
      next(error)
    }
  },
)

// GET /api/employees/:id - Read a single employee record.
employeesRouter.get(
  "/:id",
  requirePermission(Permission.EMPLOYEES_READ),
  async (request, response) => {
    const employee = await employeesRepository.findById(
      String(request.params.id),
    )
    if (!employee) {
      return response.status(404).json({ error: "Employee not found" })
    }
    return response.json({ employee: withoutEmployeeAccountDetails(employee) })
  },
)

// PUT /api/employees/:id - Partially update employee data.
employeesRouter.put(
  "/:id",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
    const parsed = validateEmployeeInput(request.body, true)
    if ("error" in parsed) {
      return response.status(400).json({ error: parsed.error })
    }
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
      next(error)
    }
  },
)

employeesRouter.patch(
  "/:id/account/status",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
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
      next(error)
    }
  },
)

employeesRouter.delete(
  "/:id/account",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
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
      next(error)
    }
  },
)
