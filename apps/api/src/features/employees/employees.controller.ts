import { Router, type Response } from "express"
import {
  EmployeeStatus,
  EmploymentType,
  Role,
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
import {
  directoryLogin,
  employeeInclude,
  employeesRepository,
} from "./employees.repository.js"
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
    const archived = parseQueryString(request.query.archived)

    if (
      archived === null ||
      !["", "true", "false"].includes(archived) ||
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

    return response.json(
      await employeesRepository.listAccounts({
        search,
        departmentId,
        employmentType,
        status,
        page,
        archived: archived === "true",
      }),
    )
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
    return response.json({ employee })
  },
)

employeesRouter.post(
  "/accounts/:accountId/profile",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    if (request.body?.password !== undefined)
      return response
        .status(400)
        .json({ error: "This account already has login credentials" })
    try {
      const employee = await getPrisma()!.$transaction(
        async (tx) => {
          const user = await tx.user.findFirst({
            where: {
              id: String(request.params.accountId),
              role: { in: [Role.ADMIN, Role.STAFF] },
              accountDeletedAt: null,
            },
            select: {
              id: true,
              email: true,
              fullName: true,
              contactNumber: true,
              employee: { select: { id: true } },
            },
          })
          if (!user) throw new EmployeeError(404, "Account not found")
          if (user.employee)
            throw new EmployeeError(
              409,
              "This account already has employee details. Refresh and try again.",
            )
          return createEmployee(tx, { ...parsed.value, userId: user.id })
        },
        { isolationLevel: "Serializable" },
      )
      return response
        .status(201)
        .json({ employee: withoutEmployeeAccountDetails(employee) })
    } catch (error) {
      if (sendError(response, error)) return
      next(error)
    }
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
    if (request.body?.password !== undefined)
      return response.status(400).json({
        error: "Create a login account using the separate account form.",
      })
    try {
      const employee = await getPrisma()!.$transaction((tx) =>
        updateEmployee(tx, String(request.params.id), parsed.value),
      )
      return response.json({
        employee: withoutEmployeeAccountDetails(employee),
      })
    } catch (error) {
      if (sendError(response, error)) return
      next(error)
    }
  },
)

employeesRouter.post(
  "/:id/account",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response, next) => {
    const password = request.body?.password
    if (!validEmployeeAccountPassword(password))
      return response.status(400).json({
        error:
          "Password must be at least 12 characters with uppercase, lowercase, number, and special character",
      })
    try {
      const passwordHash = await hashPassword(password)
      const employee = await getPrisma()!.$transaction(
        async (tx) => {
          const existing = await tx.employee.findUnique({
            where: { id: String(request.params.id) },
            include: employeeInclude,
          })
          if (!existing) throw new EmployeeError(404, "Employee not found")
          if (existing.user)
            throw new EmployeeError(
              409,
              "Employee already has an account. Manage archived accounts from Archive.",
            )
          const account = await createStaffAccount(tx, existing, passwordHash)
          return updateEmployee(tx, existing.id, { userId: account.id })
        },
        { isolationLevel: "Serializable" },
      )
      return response
        .status(201)
        .json({ employee: withoutEmployeeAccountDetails(employee) })
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
    if (typeof request.body?.isActive !== "boolean") {
      return response
        .status(400)
        .json({ error: "Provide a valid account status" })
    }
    const actor = request.auth!.user
    try {
      await getPrisma()!.$transaction(
        async (tx) => {
          const employee = await directoryLogin(tx, String(request.params.id))
          if (!employee) throw new EmployeeError(404, "Employee not found")
          if (!employee.user || employee.user.accountDeletedAt) {
            throw new EmployeeError(409, "Employee has no login account")
          }
          if (employee.user.id === actor.id) {
            throw new EmployeeError(
              403,
              "You cannot change your own login status",
            )
          }
          if (employee.user.role !== Role.STAFF) {
            throw new EmployeeError(
              403,
              "Admin accounts must be managed from Account Management",
            )
          }
          await tx.user.update({
            where: { id: employee.user.id },
            data: { isActive: request.body.isActive },
          })
          if (!request.body.isActive)
            await tx.session.deleteMany({ where: { userId: employee.user.id } })
        },
        { isolationLevel: "Serializable" },
      )
      return response.status(204).send()
    } catch (error) {
      if (sendError(response, error)) return
      next(error)
    }
  },
)

for (const permanent of [false, true]) {
  employeesRouter.delete(
    permanent ? "/:id/account/permanent" : "/:id/account",
    requirePermission(Permission.EMPLOYEES_MANAGE),
    async (request, response, next) => {
      const actor = request.auth!.user
      try {
        await getPrisma()!.$transaction(
          async (tx) => {
            const employee = await directoryLogin(tx, String(request.params.id))
            if (!employee) throw new EmployeeError(404, "Employee not found")
            if (
              !employee.user ||
              (!permanent && employee.user.accountDeletedAt)
            ) {
              throw new EmployeeError(409, "Employee has no login account")
            }
            if (employee.user.id === actor.id) {
              throw new EmployeeError(
                403,
                "You cannot delete your own login account",
              )
            }
            if (employee.user.role !== Role.STAFF) {
              throw new EmployeeError(
                403,
                "Admin accounts must be managed from Account Management",
              )
            }
            if (employee.user.isActive)
              throw new EmployeeError(
                409,
                "Deactivate the account before moving it to Archive",
              )
            if (permanent) {
              if (!employee.user.accountDeletedAt)
                throw new EmployeeError(
                  409,
                  "Move the account to Archive before deleting it permanently",
                )
              await tx.user.delete({ where: { id: employee.user.id } })
            } else {
              await tx.user.update({
                where: { id: employee.user.id },
                data: { accountDeletedAt: new Date() },
              })
              await tx.session.deleteMany({
                where: { userId: employee.user.id },
              })
            }
          },
          { isolationLevel: "Serializable" },
        )
        return response.status(204).send()
      } catch (error) {
        if (permanent && isForeignKeyViolation(error))
          return response.status(409).json({
            error:
              "This account has related records and cannot be permanently deleted. Keep it in Archive to preserve its history.",
          })
        if (sendError(response, error)) return
        next(error)
      }
    },
  )
}
