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
import {
  createEmployee,
  EmployeeError,
  employeeInclude,
  updateEmployee,
} from "./service.js"
import { validateEmployeeInput } from "./validation.js"

export const employeesRouter = Router()
employeesRouter.use(requireAuth)

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
      .json({ error: "Employee ID or account link already exists" })
    return true
  }
  const code = prismaErrorCode(error)
  if (code === "P2003") {
    response
      .status(400)
      .json({
        error: "A selected department, team, or account no longer exists",
      })
    return true
  }
  if (code === "P2025" || code === "P2034") {
    response
      .status(409)
      .json({ error: "Employee or account changed; refresh and retry" })
    return true
  }
  return false
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

// GET /api/employees/account-options - Search linkable user accounts.
employeesRouter.get(
  "/account-options",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const search = parseQueryString(request.query.search)
    const page = parsePage(request.query.page)
    const employeeId = parseQueryString(request.query.employeeId)
    if (
      search === null ||
      employeeId === null ||
      search.length > 100 ||
      page === null ||
      employeeId.length > 80
    ) {
      return response.status(400).json({ error: "Invalid account filters" })
    }

    const prisma = getPrisma()!
    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      })
      if (!employee)
        return response.status(404).json({ error: "Employee not found" })
    }

    const clauses: Prisma.UserWhereInput[] = [
      {
        OR: [
          { employee: { is: null } },
          ...(employeeId ? [{ employee: { is: { id: employeeId } } }] : []),
        ],
      },
    ]
    if (search) {
      clauses.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { fullName: { contains: search, mode: "insensitive" } },
        ],
      })
    }
    const where: Prisma.UserWhereInput = {
      role: { not: Role.SUPERADMIN },
      AND: clauses,
    }
    const pageSize = 20
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])
    return response.json({ users, total, page, pageSize })
  },
)

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
    return response.json({ employees, total, page, pageSize })
  },
)

// POST /api/employees - Create an employee record, optionally linked to an account.
employeesRouter.post(
  "/",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, false)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    try {
      const employee = await getPrisma()!.$transaction((tx) =>
        createEmployee(tx, parsed.value),
      )
      return response.status(201).json({ employee })
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
    return response.json({ employee })
  },
)

// PUT /api/employees/:id - Partially update employee data and account linkage.
employeesRouter.put(
  "/:id",
  requirePermission(Permission.EMPLOYEES_MANAGE),
  async (request, response) => {
    const parsed = validateEmployeeInput(request.body, true)
    if ("error" in parsed)
      return response.status(400).json({ error: parsed.error })
    try {
      const employee = await getPrisma()!.$transaction((tx) =>
        updateEmployee(tx, String(request.params.id), parsed.value),
      )
      return response.json({ employee })
    } catch (error) {
      if (sendError(response, error)) return
      throw error
    }
  },
)
