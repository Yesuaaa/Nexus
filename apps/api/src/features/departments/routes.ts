import { Router } from "express"
import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { Permission } from "../auth/permissions.js"
import { publicUser } from "../users/public-user.js"
import {
  EmployeeError,
  employeeInclude,
  syncEmployeeForUser,
  updateEmployee,
} from "../employees/service.js"

const departmentMemberSelect = {
  id: true,
  userId: true,
  fullName: true,
  email: true,
  contactNumber: true,
  position: true,
  teamId: true,
  team: { select: { id: true, name: true } },
  createdAt: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.EmployeeSelect

function withoutTemporaryHeadTracking<
  T extends {
    temporaryHeadOriginalId: string | null
    temporaryHeadAssignedId: string | null
  },
>(department: T) {
  const fields = { ...department }
  Reflect.deleteProperty(fields, "temporaryHeadOriginalId")
  Reflect.deleteProperty(fields, "temporaryHeadAssignedId")
  return fields
}

export const departmentsRouter = Router()
departmentsRouter.use(requireAuth)

// GET /api/departments - List departments with head and related record counts
departmentsRouter.get(
  "/",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (_request, response) => {
    const prisma = getPrisma()!
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        head: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
        _count: {
          select: { employees: true, teams: true, services: true },
        },
      },
    })

    response.json({
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        headId: d.headId,
        head: d.head,
        memberCount: d._count.employees,
        teamCount: d._count.teams,
        serviceCount: d._count.services,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    })
  },
)

// GET /api/departments/eligible-heads - List staff users who can be assigned as department head
departmentsRouter.get(
  "/eligible-heads",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (_request, response) => {
    const prisma = getPrisma()!
    const eligibleUsers = await prisma.user.findMany({
      where: {
        role: Role.STAFF,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        headOf: {
          select: { id: true, name: true },
        },
      },
      orderBy: { fullName: "asc" },
    })

    response.json({
      users: eligibleUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        headOf: u.headOf,
      })),
    })
  },
)

// GET /api/departments/employee-options - Search employee records for department assignment.
departmentsRouter.get(
  "/employee-options",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response) => {
    const search =
      request.query.search === undefined
        ? ""
        : typeof request.query.search === "string"
          ? request.query.search.trim()
          : null
    const pageValue = request.query.page
    const page =
      pageValue === undefined
        ? 1
        : typeof pageValue === "string" && /^\d+$/.test(pageValue)
          ? Number(pageValue)
          : null
    if (
      search === null ||
      search.length > 100 ||
      page === null ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1_000_000
    ) {
      return response.status(400).json({ error: "Invalid employee filters" })
    }

    const where: Prisma.EmployeeWhereInput = search
      ? {
          OR: [
            { employeeId: { contains: search, mode: "insensitive" } },
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { contactNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}
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

// GET /api/departments/:id - Get department details with list of members and teams
departmentsRouter.get(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response) => {
    const prisma = getPrisma()!
    const department = await prisma.$transaction(async (tx) => {
      const departmentId = String(request.params.id)
      const existing = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true, headId: true },
      })
      if (!existing) return null

      const staleMembers = await tx.user.findMany({
        where: {
          departmentId,
          id: { not: existing.headId ?? "" },
          position: {
            in: [
              "Dept Head",
              "dept head",
              "Department Head",
              "department head",
            ],
          },
        },
        select: { id: true },
      })
      for (const member of staleMembers) {
        await tx.user.update({
          where: { id: member.id },
          data: { position: null },
        })
        await syncEmployeeForUser(tx, member.id)
      }

      if (existing.headId) {
        const headWithTeam = await tx.user.findFirst({
          where: { id: existing.headId, teamId: { not: null } },
          select: { id: true },
        })
        if (headWithTeam) {
          await tx.user.update({
            where: { id: headWithTeam.id },
            data: { teamId: null },
          })
          await syncEmployeeForUser(tx, headWithTeam.id)
        }
      }

      return tx.department.findUnique({
        where: { id: departmentId },
        include: {
          head: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
              position: true,
            },
          },
          employees: {
            select: departmentMemberSelect,
            orderBy: [{ fullName: "asc" }, { employeeId: "asc" }],
          },
          teams: {
            include: {
              lead: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                  role: true,
                  position: true,
                },
              },
              _count: {
                select: { employees: true },
              },
            },
            orderBy: { name: "asc" },
          },
        },
      })
    })

    if (!department) {
      return response.status(404).json({ error: "Department not found" })
    }

    const { employees, teams, ...departmentFields } = department

    response.json({
      department: {
        ...withoutTemporaryHeadTracking(departmentFields),
        members: employees,
        memberCount: employees.length,
        teamCount: teams.length,
        teams: teams.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          departmentId: t.departmentId,
          leadId: t.leadId,
          lead: t.lead,
          memberCount: t._count.employees,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      },
    })
  },
)

// POST /api/departments - Create a new department
departmentsRouter.post(
  "/",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const name =
      typeof request.body?.name === "string" ? request.body.name.trim() : ""
    const code =
      typeof request.body?.code === "string"
        ? request.body.code.trim().toUpperCase()
        : null
    const description =
      typeof request.body?.description === "string"
        ? request.body.description.trim()
        : null
    const headId =
      typeof request.body?.headId === "string" && request.body.headId.trim()
        ? request.body.headId.trim()
        : null

    if (!name || name.length < 2 || name.length > 80) {
      return response
        .status(400)
        .json({ error: "Department name must be between 2 and 80 characters" })
    }

    if (code && (code.length < 2 || code.length > 20)) {
      return response
        .status(400)
        .json({ error: "Department code must be between 2 and 20 characters" })
    }

    const prisma = getPrisma()!

    if (headId) {
      const headUser = await prisma.user.findUnique({ where: { id: headId } })
      if (!headUser) {
        return response
          .status(400)
          .json({ error: "Selected department head user not found" })
      }
      const teamLead = await prisma.team.findFirst({
        where: { leadId: headId },
        select: { id: true },
      })
      if (teamLead) {
        return response.status(409).json({
          error:
            "Reassign this Team Lead before making them a Department Head.",
        })
      }
    }

    try {
      const department = await prisma.$transaction(async (tx) => {
        const created = await tx.department.create({
          data: {
            name,
            code: code || null,
            description: description || null,
            headId,
          },
        })

        if (headId) {
          await tx.user.update({
            where: { id: headId },
            data: { departmentId: created.id, teamId: null },
          })
          await syncEmployeeForUser(tx, headId)
        }

        return tx.department.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            head: {
              select: { id: true, email: true, fullName: true, role: true },
            },
            _count: { select: { employees: true } },
          },
        })
      })

      return response.status(201).json({
        department: {
          ...withoutTemporaryHeadTracking(department),
          memberCount: department._count.employees,
        },
      })
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return response
          .status(409)
          .json({ error: "Department name or code already exists" })
      }
      throw error
    }
  },
)

// PUT /api/departments/:id - Update department details or head
departmentsRouter.put(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    const name =
      typeof request.body?.name === "string"
        ? request.body.name.trim()
        : undefined
    const code =
      request.body?.code !== undefined
        ? typeof request.body?.code === "string" && request.body.code.trim()
          ? request.body.code.trim().toUpperCase()
          : null
        : undefined
    const description =
      request.body?.description !== undefined
        ? typeof request.body?.description === "string" &&
          request.body.description.trim()
          ? request.body.description.trim()
          : null
        : undefined
    const headId =
      request.body?.headId !== undefined
        ? typeof request.body?.headId === "string" && request.body.headId.trim()
          ? request.body.headId.trim()
          : null
        : undefined

    if (name !== undefined && (name.length < 2 || name.length > 80)) {
      return response
        .status(400)
        .json({ error: "Department name must be between 2 and 80 characters" })
    }

    if (
      code !== undefined &&
      code !== null &&
      (code.length < 2 || code.length > 20)
    ) {
      return response
        .status(400)
        .json({ error: "Department code must be between 2 and 20 characters" })
    }

    const prisma = getPrisma()!

    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) {
      return response.status(404).json({ error: "Department not found" })
    }

    if (headId) {
      const headUser = await prisma.user.findUnique({ where: { id: headId } })
      if (!headUser) {
        return response
          .status(400)
          .json({ error: "Selected department head user not found" })
      }
      const teamLead = await prisma.team.findFirst({
        where: { leadId: headId },
        select: { id: true },
      })
      if (teamLead) {
        return response.status(409).json({
          error:
            "Reassign this Team Lead before making them a Department Head.",
        })
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Department" WHERE "id" = ${id} FOR UPDATE`,
        )
        const current = await tx.department.findUniqueOrThrow({ where: { id } })
        const headChanged = headId !== undefined && current.headId !== headId
        const saved = await tx.department.update({
          where: { id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(code !== undefined ? { code } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(headId !== undefined ? { headId } : {}),
            ...(headChanged
              ? {
                  temporaryHeadOriginalId: null,
                  temporaryHeadAssignedId: null,
                }
              : {}),
          },
        })

        if (headId !== undefined) {
          if (current.headId && current.headId !== headId) {
            const oldHead = await tx.user.findUnique({
              where: { id: current.headId },
              select: { id: true, position: true },
            })
            if (
              oldHead?.position &&
              ["dept head", "department head"].includes(
                oldHead.position.toLowerCase(),
              )
            ) {
              await tx.user.update({
                where: { id: oldHead.id },
                data: { position: null },
              })
            }
            await syncEmployeeForUser(tx, current.headId)
          }

          if (headId) {
            await tx.user.update({
              where: { id: headId },
              data: { departmentId: id, teamId: null },
            })
            await syncEmployeeForUser(tx, headId)
          }
        }

        return tx.department.findUniqueOrThrow({
          where: { id: saved.id },
          include: {
            head: {
              select: { id: true, email: true, fullName: true, role: true },
            },
            _count: { select: { employees: true } },
          },
        })
      })

      return response.json({
        department: {
          ...withoutTemporaryHeadTracking(updated),
          memberCount: updated._count.employees,
        },
      })
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return response
          .status(409)
          .json({ error: "Department name or code already exists" })
      }
      throw error
    }
  },
)

// POST /api/departments/:id/members - Assign employees to this department
departmentsRouter.post(
  "/:id/members",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    const employeeIds = request.body?.employeeIds
    const userIds = request.body?.userIds

    if (
      (employeeIds === undefined && userIds === undefined) ||
      (employeeIds !== undefined &&
        (!Array.isArray(employeeIds) ||
          employeeIds.length === 0 ||
          employeeIds.length > 1000 ||
          !employeeIds.every(
            (employeeId) =>
              typeof employeeId === "string" &&
              employeeId.length > 0 &&
              employeeId.length <= 80,
          ))) ||
      (userIds !== undefined &&
        (!Array.isArray(userIds) ||
          userIds.length === 0 ||
          userIds.length > 1000 ||
          !userIds.every(
            (userId) =>
              typeof userId === "string" &&
              userId.length > 0 &&
              userId.length <= 80,
          )))
    ) {
      return response
        .status(400)
        .json({ error: "Provide a list of employee IDs to assign" })
    }

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }

    if (userIds !== undefined) {
      const eligibleUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: Role.STAFF,
          accountDeletedAt: null,
        },
        select: { id: true },
      })
      if (eligibleUsers.length !== userIds.length) {
        return response.status(400).json({
          error: "Only active staff accounts can be assigned to a department",
        })
      }
    }

    try {
      const updatedMembers = await prisma.$transaction(async (tx) => {
        for (const employeeId of employeeIds ?? []) {
          const employee = await tx.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, departmentId: true, teamId: true },
          })
          if (!employee) {
            throw new EmployeeError(404, "Employee not found")
          }
          const currentTeam = employee.teamId
            ? await tx.team.findUnique({
                where: { id: employee.teamId },
                select: { departmentId: true },
              })
            : null
          await updateEmployee(tx, employee.id, {
            departmentId: id,
            ...(currentTeam?.departmentId !== id ? { teamId: null } : {}),
          })
        }

        for (const userId of userIds ?? []) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true, teamId: true },
          })
          if (!user) {
            throw new EmployeeError(404, "User not found")
          }
          await syncEmployeeForUser(tx, user.id)
          const employee = await tx.employee.findUnique({
            where: { userId: user.id },
            select: { id: true, departmentId: true, teamId: true },
          })
          if (!employee) {
            const currentTeam = user.teamId
              ? await tx.team.findUnique({
                  where: { id: user.teamId },
                  select: { departmentId: true },
                })
              : null
            await tx.user.update({
              where: { id: user.id },
              data: {
                departmentId: id,
                ...(currentTeam?.departmentId !== id ? { teamId: null } : {}),
              },
            })
            await syncEmployeeForUser(tx, user.id)
          } else {
            const currentTeam = employee.teamId
              ? await tx.team.findUnique({
                  where: { id: employee.teamId },
                  select: { departmentId: true },
                })
              : null
            await updateEmployee(tx, employee.id, {
              departmentId: id,
              ...(currentTeam?.departmentId !== id ? { teamId: null } : {}),
            })
          }
        }

        return tx.employee.findMany({
          where: { departmentId: id },
          include: employeeInclude,
          orderBy: [{ fullName: "asc" }, { employeeId: "asc" }],
        })
      })

      return response.json({
        message: "Members assigned successfully",
        members: updatedMembers,
      })
    } catch (error) {
      if (error instanceof EmployeeError) {
        return response.status(error.status).json({ error: error.message })
      }
      throw error
    }
  },
)

// DELETE /api/departments/:id/members/:memberId - Remove employee from department
departmentsRouter.delete(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    const memberId = String(request.params.memberId)

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }

    const employee = await prisma.employee.findFirst({
      where: { id: memberId, departmentId: id },
      select: { id: true, userId: true },
    })

    if (employee) {
      if (dept.headId !== null && dept.headId === employee.userId) {
        return response.status(400).json({
          error:
            "Cannot remove the Department Head from members. To remove or replace the head, use Edit Department.",
        })
      }
      try {
        await prisma.$transaction((tx) =>
          updateEmployee(tx, employee.id, { departmentId: null, teamId: null }),
        )
        return response.json({ message: "Employee removed from department" })
      } catch (error) {
        if (error instanceof EmployeeError) {
          return response.status(error.status).json({ error: error.message })
        }
        throw error
      }
    }

    const user = await prisma.user.findFirst({
      where: { id: memberId, departmentId: id },
      select: { id: true },
    })
    if (!user) return response.status(404).json({ error: "Member not found" })
    if (dept.headId !== null && dept.headId === user.id) {
      return response.status(400).json({
        error:
          "Cannot remove the Department Head from members. To remove or replace the head, use Edit Department.",
      })
    }
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { departmentId: null, teamId: null },
      })
      await syncEmployeeForUser(tx, user.id)
    })
    return response.json({ message: "Employee removed from department" })
  },
)

// DELETE /api/departments/:id - Delete department
departmentsRouter.delete(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_DELETE),
  async (request, response) => {
    const id = String(request.params.id)
    const prisma = getPrisma()!

    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }

    const serviceCount = await prisma.service.count({
      where: { departments: { some: { id } } },
    })
    if (serviceCount > 0) {
      return response.status(409).json({
        error:
          "Reassign or remove this department's services before deleting the department",
      })
    }

    await prisma.$transaction(async (tx) => {
      const linkedUsers = await tx.user.findMany({
        where: { departmentId: id },
        select: { id: true },
      })
      await tx.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null, teamId: null },
      })
      await tx.employee.updateMany({
        where: { departmentId: id },
        data: { departmentId: null, teamId: null },
      })
      for (const user of linkedUsers) {
        await syncEmployeeForUser(tx, user.id)
      }
      await tx.department.delete({ where: { id } })
    })

    return response.json({ message: "Department deleted successfully" })
  },
)

// POST /api/departments/:id/teams - Create a team in department
departmentsRouter.post(
  "/:id/teams",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const departmentId = String(request.params.id)
    const name =
      typeof request.body?.name === "string" ? request.body.name.trim() : ""
    const description =
      typeof request.body?.description === "string"
        ? request.body.description.trim()
        : null
    const leadId =
      typeof request.body?.leadId === "string" && request.body.leadId.trim()
        ? request.body.leadId.trim()
        : null

    if (!name || name.length < 2 || name.length > 80) {
      return response
        .status(400)
        .json({ error: "Team name must be between 2 and 80 characters" })
    }

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }
    if (leadId) {
      const leadDepartment = await prisma.department.findFirst({
        where: { headId: leadId },
        select: { id: true },
      })
      const otherLeadTeam = await prisma.team.findFirst({
        where: { leadId },
        select: { id: true },
      })
      if (leadDepartment || otherLeadTeam) {
        return response.status(400).json({
          error:
            "Reassign the current lead role before assigning this Team Lead.",
        })
      }
    }

    try {
      const team = await prisma.$transaction(async (tx) => {
        const created = await tx.team.create({
          data: {
            name,
            description: description || null,
            departmentId,
            leadId,
          },
        })

        if (leadId) {
          await tx.user.update({
            where: { id: leadId },
            data: { departmentId, teamId: created.id },
          })
          await syncEmployeeForUser(tx, leadId)
        }

        return tx.team.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                position: true,
              },
            },
            _count: { select: { employees: true } },
          },
        })
      })

      return response.status(201).json({
        team: {
          ...team,
          memberCount: team._count.employees,
        },
      })
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return response.status(409).json({
          error: "A team with that name already exists in this department",
        })
      }
      throw error
    }
  },
)

// PUT /api/departments/:id/teams/:teamId - Update a team
departmentsRouter.put(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const departmentId = String(request.params.id)
    const teamId = String(request.params.teamId)
    const name =
      typeof request.body?.name === "string"
        ? request.body.name.trim()
        : undefined
    const description =
      request.body?.description !== undefined
        ? typeof request.body?.description === "string" &&
          request.body.description.trim()
          ? request.body.description.trim()
          : null
        : undefined
    const leadId =
      request.body?.leadId !== undefined
        ? typeof request.body?.leadId === "string" && request.body.leadId.trim()
          ? request.body.leadId.trim()
          : null
        : undefined

    if (name !== undefined && (name.length < 2 || name.length > 80)) {
      return response
        .status(400)
        .json({ error: "Team name must be between 2 and 80 characters" })
    }

    const prisma = getPrisma()!
    const existing = await prisma.team.findFirst({
      where: { id: teamId, departmentId },
    })
    if (!existing) {
      return response.status(404).json({ error: "Team not found" })
    }

    if (leadId) {
      const [leadDepartment, otherLeadTeam] = await Promise.all([
        prisma.department.findFirst({
          where: { headId: leadId },
          select: { id: true },
        }),
        prisma.team.findFirst({
          where: { leadId, id: { not: teamId } },
          select: { id: true },
        }),
      ])
      if (leadDepartment || otherLeadTeam) {
        return response.status(409).json({
          error:
            "Reassign the current lead role before assigning this Team Lead.",
        })
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: teamId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(leadId !== undefined ? { leadId } : {}),
          },
        })

        if (existing.leadId && existing.leadId !== leadId) {
          await syncEmployeeForUser(tx, existing.leadId)
        }

        if (leadId) {
          await tx.user.update({
            where: { id: leadId },
            data: { departmentId, teamId },
          })
          await syncEmployeeForUser(tx, leadId)
        }

        return tx.team.findUniqueOrThrow({
          where: { id: teamId },
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                position: true,
              },
            },
            _count: { select: { employees: true } },
          },
        })
      })

      return response.json({
        team: {
          ...updated,
          memberCount: updated._count.employees,
        },
      })
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return response.status(409).json({
          error: "A team with that name already exists in this department",
        })
      }
      throw error
    }
  },
)

// DELETE /api/departments/:id/teams/:teamId - Delete a team
departmentsRouter.delete(
  "/:id/teams/:teamId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const departmentId = String(request.params.id)
    const teamId = String(request.params.teamId)
    const prisma = getPrisma()!

    const existing = await prisma.team.findFirst({
      where: { id: teamId, departmentId },
    })
    if (!existing) {
      return response.status(404).json({ error: "Team not found" })
    }

    await prisma.$transaction(async (tx) => {
      const linkedUsers = await tx.user.findMany({
        where: { teamId },
        select: { id: true },
      })
      await tx.user.updateMany({
        where: { teamId },
        data: { teamId: null },
      })
      await tx.employee.updateMany({
        where: { teamId },
        data: { teamId: null },
      })
      for (const user of linkedUsers) {
        await syncEmployeeForUser(tx, user.id)
      }
      await tx.team.delete({ where: { id: teamId } })
    })

    return response.json({ message: "Team deleted successfully" })
  },
)

// PATCH /api/departments/:id/members/:memberId - Update member position and team
departmentsRouter.patch(
  "/:id/members/:memberId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const departmentId = String(request.params.id)
    const memberId = String(request.params.memberId)
    const position =
      request.body?.position !== undefined
        ? typeof request.body?.position === "string" &&
          request.body.position.trim()
          ? request.body.position.trim()
          : null
        : undefined
    const teamId =
      request.body?.teamId !== undefined
        ? typeof request.body?.teamId === "string" && request.body.teamId.trim()
          ? request.body.teamId.trim()
          : null
        : undefined

    const prisma = getPrisma()!
    const employee = await prisma.employee.findFirst({
      where: { id: memberId, departmentId },
      select: { id: true, userId: true },
    })
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { headId: true },
    })
    if (employee && dept?.headId && dept.headId === employee.userId && teamId) {
      return response.status(400).json({
        error:
          "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      })
    }

    const user = employee
      ? null
      : await prisma.user.findFirst({
          where: { id: memberId, departmentId },
        })
    if (!employee && !user) {
      return response
        .status(404)
        .json({ error: "Member not found in this department" })
    }
    if (user && teamId && user.role !== Role.STAFF) {
      return response
        .status(400)
        .json({ error: "Only staff accounts can be assigned to a team" })
    }
    if (user && dept?.headId && dept.headId === user.id && teamId) {
      return response.status(400).json({
        error:
          "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      })
    }

    if (position !== undefined && position !== null) {
      const lower = position.toLowerCase()
      if (
        (dept?.headId == null ||
          dept.headId !== (employee?.userId ?? user?.id)) &&
        (lower === "dept head" || lower === "department head")
      ) {
        return response.status(400).json({
          error:
            "Only the assigned Department Head can have the title 'Department Head'. For regular members, please specify their job title (e.g. Specialist, Analyst, Coordinator).",
        })
      }
    }

    if (teamId) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, departmentId },
      })
      if (!team) {
        return response
          .status(400)
          .json({ error: "Team not found in this department" })
      }
    }

    try {
      if (employee) {
        const updated = await prisma.$transaction((tx) =>
          updateEmployee(tx, employee.id, {
            ...(position !== undefined ? { position } : {}),
            ...(teamId !== undefined ? { teamId } : {}),
          }),
        )
        return response.json({ employee: updated })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const saved = await tx.user.update({
          where: { id: user!.id },
          data: {
            ...(position !== undefined ? { position } : {}),
            ...(teamId !== undefined ? { teamId } : {}),
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            team: { select: { id: true, name: true } },
          },
        })
        await syncEmployeeForUser(tx, saved.id)
        return saved
      })

      return response.json({ user: publicUser(updated) })
    } catch (error) {
      if (error instanceof EmployeeError) {
        return response.status(error.status).json({ error: error.message })
      }
      throw error
    }
  },
)
