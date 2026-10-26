import { Router } from "express"
import { Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { requireAuth, requirePermission } from "../auth/session.js"
import { Permission } from "../auth/permissions.js"
import { publicUser } from "../users/public-user.js"

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
          select: { members: true, teams: true, services: true },
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
        memberCount: d._count.members,
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

// GET /api/departments/:id - Get department details with list of members and teams
departmentsRouter.get(
  "/:id",
  requirePermission(Permission.DEPARTMENTS_READ),
  async (request, response) => {
    const prisma = getPrisma()!
    const department = await prisma.department.findUnique({
      where: { id: String(request.params.id) },
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
        members: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            position: true,
            contactNumber: true,
            teamId: true,
            team: {
              select: { id: true, name: true },
            },
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ role: "asc" }, { fullName: "asc" }],
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
              select: { members: true },
            },
          },
          orderBy: { name: "asc" },
        },
      },
    })

    if (!department) {
      return response.status(404).json({ error: "Department not found" })
    }

    // Clean up any stale "Dept Head" positions on members who are not the department head
    await prisma.user.updateMany({
      where: {
        departmentId: department.id,
        id: { not: department.headId ?? "" },
        position: {
          in: ["Dept Head", "dept head", "Department Head", "department head"],
        },
      },
      data: { position: null },
    })

    if (department.headId) {
      await prisma.user.updateMany({
        where: { id: department.headId, teamId: { not: null } },
        data: { teamId: null },
      })
    }

    response.json({
      department: {
        ...department,
        members: department.members.map((m) => {
          const isHead = m.id === department.headId
          const lowerPos = m.position?.toLowerCase()
          const hasStaleHeadPos =
            !isHead &&
            (lowerPos === "dept head" || lowerPos === "department head")
          return {
            ...m,
            position: hasStaleHeadPos ? null : m.position,
            teamId: isHead ? null : m.teamId,
            team: isHead ? null : m.team,
          }
        }),
        teams: department.teams.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          departmentId: t.departmentId,
          leadId: t.leadId,
          lead: t.lead,
          memberCount: t._count.members,
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
    }

    try {
      const department = await prisma.department.create({
        data: {
          name,
          code: code || null,
          description: description || null,
          headId,
        },
        include: {
          head: {
            select: { id: true, email: true, fullName: true, role: true },
          },
          _count: { select: { members: true } },
        },
      })

      // Also ensure that the head is a member of this department with no sub-team
      if (headId) {
        await prisma.user.update({
          where: { id: headId },
          data: { departmentId: department.id, teamId: null },
        })
      }

      return response.status(201).json({
        department: {
          ...department,
          memberCount: department._count.members,
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
    }

    try {
      const updated = await prisma.department.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(headId !== undefined ? { headId } : {}),
        },
        include: {
          head: {
            select: { id: true, email: true, fullName: true, role: true },
          },
          _count: { select: { members: true } },
        },
      })

      if (headId !== undefined) {
        if (existing.headId && existing.headId !== headId) {
          await prisma.user.updateMany({
            where: {
              id: existing.headId,
              position: {
                in: [
                  "Dept Head",
                  "dept head",
                  "Department Head",
                  "department head",
                ],
              },
            },
            data: { position: null },
          })
        }

        if (headId) {
          await prisma.user.update({
            where: { id: headId },
            data: { departmentId: id, teamId: null },
          })
        }
      }

      return response.json({
        department: {
          ...updated,
          memberCount: updated._count.members,
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
    const userIds = request.body?.userIds

    if (
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      !userIds.every((uid) => typeof uid === "string")
    ) {
      return response
        .status(400)
        .json({ error: "Provide a list of user IDs to assign" })
    }

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }

    const eligibleUsers = await prisma.user.findMany({
      where: { id: { in: userIds }, role: Role.STAFF },
      select: { id: true },
    })
    if (eligibleUsers.length !== new Set(userIds).size) {
      return response
        .status(400)
        .json({ error: "Only staff accounts can be assigned to a department" })
    }

    await prisma.user.updateMany({
      where: { id: { in: userIds }, role: Role.STAFF },
      data: { departmentId: id },
    })

    const updatedMembers = await prisma.user.findMany({
      where: { departmentId: id },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    })

    return response.json({
      message: "Members assigned successfully",
      members: updatedMembers.map(publicUser),
    })
  },
)

// DELETE /api/departments/:id/members/:userId - Remove employee from department
departmentsRouter.delete(
  "/:id/members/:userId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const id = String(request.params.id)
    const userId = String(request.params.userId)

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      return response.status(404).json({ error: "Department not found" })
    }

    // Check if the user is the head of the department
    if (dept.headId === userId) {
      return response.status(400).json({
        error:
          "Cannot remove the Department Head from members. To remove or replace the head, use Edit Department.",
      })
    }

    await prisma.user.updateMany({
      where: { id: userId, departmentId: id },
      data: { departmentId: null },
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

    // Clear departmentId from all members before deletion
    await prisma.user.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    })

    await prisma.department.delete({ where: { id } })

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

    try {
      const team = await prisma.team.create({
        data: {
          name,
          description: description || null,
          departmentId,
          leadId,
        },
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
          _count: { select: { members: true } },
        },
      })

      // If leadId is set, ensure they belong to this department and team
      if (leadId) {
        await prisma.user.update({
          where: { id: leadId },
          data: { departmentId, teamId: team.id },
        })
      }

      return response.status(201).json({
        team: {
          ...team,
          memberCount: team._count.members,
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

    try {
      const updated = await prisma.team.update({
        where: { id: teamId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(leadId !== undefined ? { leadId } : {}),
        },
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
          _count: { select: { members: true } },
        },
      })

      if (leadId) {
        await prisma.user.update({
          where: { id: leadId },
          data: { departmentId, teamId },
        })
      }

      return response.json({
        team: {
          ...updated,
          memberCount: updated._count.members,
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

    // Unlink members from this team
    await prisma.user.updateMany({
      where: { teamId },
      data: { teamId: null },
    })

    await prisma.team.delete({ where: { id: teamId } })

    return response.json({ message: "Team deleted successfully" })
  },
)

// PATCH /api/departments/:id/members/:userId - Update member position and team
departmentsRouter.patch(
  "/:id/members/:userId",
  requirePermission(Permission.DEPARTMENTS_MANAGE),
  async (request, response) => {
    const departmentId = String(request.params.id)
    const userId = String(request.params.userId)
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
    const user = await prisma.user.findFirst({
      where: { id: userId, departmentId },
    })
    if (!user) {
      return response
        .status(404)
        .json({ error: "Member not found in this department" })
    }

    if (teamId && user.role !== Role.STAFF) {
      return response
        .status(400)
        .json({ error: "Only staff accounts can be assigned to a team" })
    }

    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { headId: true },
    })
    if (dept?.headId === userId && teamId) {
      return response.status(400).json({
        error:
          "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      })
    }

    if (position !== undefined && position !== null) {
      const lower = position.toLowerCase()
      if (
        dept?.headId !== userId &&
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

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(position !== undefined ? { position } : {}),
        ...(teamId !== undefined ? { teamId } : {}),
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        team: { select: { id: true, name: true } },
      },
    })

    return response.json({ user: publicUser(updated) })
  },
)
