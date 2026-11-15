import { Router } from "express"
import {
  EmployeeStatus,
  EmploymentType,
  Role,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { mapPrismaErrors } from "../../shared/http-error.js"
import { createManagementOperation } from "../../shared/management-history.js"
import { writeAccountManagementChange } from "../users/account-management-history.js"
import {
  writeWorkforceManagementChange,
  type WorkforceManagementChangeInput,
} from "./workforce-management-history.js"
import {
  PASSWORD_POLICY_MESSAGE,
  isStrongPassword,
} from "../../shared/password-policy.js"
import { parseQueryString } from "../../shared/query-helpers.js"
import { parsePage } from "../../shared/query/pagination.js"
import { requireAuth, requirePermission } from "../auth/auth.middleware.js"
import { hashPassword } from "../auth/auth.password.js"
import { Permission } from "../auth/auth.permissions.js"
import { employeeInclude, employeesRepository } from "./employees.repository.js"
import { validateEmployeeInput } from "./employees.schema.js"
import { createEmployeeWithAttribution } from "./employee-creation.service.js"
import {
  createStaffAccount,
  EmployeeError,
  getEmployeeStatusOptions,
  removeEmployeeLogin,
  setEmployeeLoginStatus,
  updateEmployee,
  withoutEmployeeAccountDetails,
} from "./employees.service.js"

export const employeesRouter = Router()
employeesRouter.use(requireAuth)

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
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed) {
      return response.status(400).json({ error: parsed.error })
    }
    const password: unknown = request.body?.password
    if (!isStrongPassword(password)) {
      return response.status(400).json({ error: PASSWORD_POLICY_MESSAGE })
    }
    const passwordHash = await hashPassword(password)
    const operation = createManagementOperation(request.auth!)
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
      return createEmployeeWithAttribution(
        tx,
        { ...parsed.value, userId: account.id },
        operation,
        "NEW_STAFF_ACCOUNT",
      )
    })
    return response
      .status(201)
      .json({ employee: withoutEmployeeAccountDetails(employee) })
  },
)

// GET /api/employees/:id/status-options - Read department head handoff choices.
employeesRouter.get(
  "/:id/status-options",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const options = await getPrisma()!.$transaction((tx) =>
      getEmployeeStatusOptions(tx, String(request.params.id)),
    )
    return response.json(options)
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
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    if (request.body?.password !== undefined)
      return response
        .status(400)
        .json({ error: "This account already has login credentials" })
    const operation = createManagementOperation(request.auth!)
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
        return createEmployeeWithAttribution(
          tx,
          { ...parsed.value, userId: user.id },
          operation,
          "EXISTING_ACCOUNT_PROFILE",
        )
      },
      { isolationLevel: "Serializable" },
    )
    return response
      .status(201)
      .json({ employee: withoutEmployeeAccountDetails(employee) })
  },
)

// PUT /api/employees/:id - Partially update employee data.
employeesRouter.put(
  "/:id",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, true)
    if ("error" in parsed) {
      return response.status(400).json({ error: parsed.error })
    }
    if (request.body?.password !== undefined)
      return response.status(400).json({
        error: "Create a login account using the separate account form.",
      })
    const operation = createManagementOperation(request.auth!)
    const employee = await getPrisma()!.$transaction((tx) =>
      updateEmployee(tx, String(request.params.id), parsed.value, operation),
    )
    return response.json({
      employee: withoutEmployeeAccountDetails(employee),
    })
  },
)

employeesRouter.post(
  "/:id/account",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const password: unknown = request.body?.password
    if (!isStrongPassword(password))
      return response.status(400).json({ error: PASSWORD_POLICY_MESSAGE })
    const passwordHash = await hashPassword(password)
    const operation = createManagementOperation(request.auth!)
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
        const updated = await updateEmployee(tx, existing.id, {
          userId: account.id,
        })
        const login = await tx.user.findUniqueOrThrow({
          where: { id: account.id },
          select: {
            role: true,
            isActive: true,
            departmentId: true,
            teamId: true,
          },
        })
        await writeAccountManagementChange(tx, operation, {
          subjectAccountId: account.id,
          origin: "EMPLOYEE_MANAGEMENT",
          action: "CREATED",
          changedFields: [
            "role",
            "isActive",
            "fullName",
            "email",
            "contactNumber",
          ],
          changes: {
            role: { before: null, after: login.role },
            isActive: { before: null, after: login.isActive },
          },
        })
        const changedFields = (
          ["userId", "departmentId", "teamId"] as const
        ).filter((key) => existing[key] !== updated[key])
        if (changedFields.length) {
          const changes: Extract<
            WorkforceManagementChangeInput,
            { action: "ASSIGNMENT_CHANGED" }
          >["changes"] = {}
          for (const key of changedFields)
            changes[key] = { before: existing[key], after: updated[key] }
          await writeWorkforceManagementChange(tx, operation, {
            origin: "EMPLOYEE_MANAGEMENT",
            action: "ASSIGNMENT_CHANGED",
            subjectType: "EMPLOYEE",
            subjectId: updated.id,
            changedFields,
            changes,
          })
        }
        if (login.departmentId) {
          await writeWorkforceManagementChange(tx, operation, {
            origin: "EMPLOYEE_MANAGEMENT",
            action: "ASSIGNMENT_CHANGED",
            subjectType: "DEPARTMENT",
            subjectId: login.departmentId,
            changedFields: [
              "departmentId",
              ...(login.teamId ? ["teamId" as const] : []),
            ],
            changes: {
              affectedAccountId: account.id,
              departmentId: { before: null, after: login.departmentId },
              ...(login.teamId
                ? { teamId: { before: null, after: login.teamId } }
                : {}),
            },
          })
        }
        return updated
      },
      { isolationLevel: "Serializable" },
    )
    return response
      .status(201)
      .json({ employee: withoutEmployeeAccountDetails(employee) })
  },
)

// Login lifecycle: STAFF logins only, never the actor's own.
employeesRouter.patch(
  "/:id/account/status",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    if (typeof request.body?.isActive !== "boolean") {
      return response
        .status(400)
        .json({ error: "Provide a valid account status" })
    }
    await setEmployeeLoginStatus(
      request.auth!,
      String(request.params.id),
      request.body.isActive,
    )
    return response.status(204).send()
  },
)

for (const permanent of [false, true]) {
  employeesRouter.delete(
    permanent ? "/:id/account/permanent" : "/:id/account",
    requirePermission(Permission.EMPLOYEES_MANAGE),
    async (request, response) => {
      await removeEmployeeLogin(request.auth!, String(request.params.id), {
        permanent,
      })
      return response.status(204).send()
    },
  )
}

// Employee writes share these conflict messages (P2002 is employee ID/email).
employeesRouter.use(
  mapPrismaErrors({
    P2002: {
      status: 409,
      message: "Employee ID or account email already exists",
    },
    P2003: {
      status: 400,
      message: "A selected department or team no longer exists",
    },
    P2025: { status: 409, message: "Employee changed; refresh and retry" },
    P2034: { status: 409, message: "Employee changed; refresh and retry" },
  }),
)
