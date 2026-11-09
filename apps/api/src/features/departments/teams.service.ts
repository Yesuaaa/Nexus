import { EmployeeStatus, Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import {
  EmployeeError,
  syncEmployeeForUser,
  updateEmployee,
} from "../employees/employees.service.js"
import {
  validateTeamCreateInput,
  validateTeamUpdateInput,
} from "./departments.schema.js"

export class TeamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "TeamError"
  }
}

async function validateTeamLead(
  tx: Prisma.TransactionClient,
  departmentId: string,
  leadId: string,
  currentTeamId: string | undefined,
  conflictStatus: number,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${leadId} FOR UPDATE`,
  )
  const candidate = await tx.user.findUnique({
    where: { id: leadId },
    select: {
      role: true,
      isActive: true,
      accountDeletedAt: true,
      departmentId: true,
      employee: { select: { departmentId: true, status: true } },
      team: { select: { departmentId: true } },
    },
  })

  if (
    !candidate ||
    candidate.role !== "STAFF" ||
    !candidate.isActive ||
    candidate.accountDeletedAt
  ) {
    throw new TeamError(400, "Only active staff accounts can be Team Leads.")
  }

  if (candidate.employee && candidate.employee.status !== "ACTIVE") {
    throw new TeamError(
      400,
      "Only employees with active status can be Team Leads.",
    )
  }

  const assignedDepartmentIds = [
    candidate.departmentId,
    candidate.employee?.departmentId,
    candidate.team?.departmentId,
  ].filter((id): id is string => id != null)
  if (assignedDepartmentIds.some((id) => id !== departmentId)) {
    throw new TeamError(
      400,
      "Team Leads must belong to the department that owns the team.",
    )
  }

  const [departmentHead, otherLeadTeam] = await Promise.all([
    tx.department.findFirst({
      where: { headId: leadId },
      select: { id: true },
    }),
    tx.team.findFirst({
      where: {
        leadId,
        ...(currentTeamId ? { id: { not: currentTeamId } } : {}),
      },
      select: { id: true },
    }),
  ])
  if (departmentHead || otherLeadTeam) {
    throw new TeamError(
      conflictStatus,
      "Reassign the current lead role before assigning this Team Lead.",
    )
  }
}

export const teamsService = {
  async createTeam(departmentId: string, body: unknown) {
    const parsed = validateTeamCreateInput(body)
    if (!parsed.value) {
      throw new TeamError(400, parsed.error)
    }

    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    })
    if (!dept) {
      throw new TeamError(404, "Department not found")
    }

    const { name, description, leadId, memberIds } = parsed.value

    try {
      const team = await prisma.$transaction(async (tx) => {
        if (leadId) {
          await validateTeamLead(tx, departmentId, leadId, undefined, 400)
        }

        if (memberIds) {
          const members = await tx.employee.findMany({
            where: {
              id: { in: memberIds },
              departmentId,
              status: EmployeeStatus.ACTIVE,
              user: {
                is: {
                  role: Role.STAFF,
                  isActive: true,
                  accountDeletedAt: null,
                },
              },
            },
            select: { id: true, userId: true },
          })

          if (members.length !== memberIds.length) {
            throw new TeamError(
              400,
              "Team members must be active staff in this department.",
            )
          }

          if (
            dept.headId !== null &&
            members.some((member) => member.userId === dept.headId)
          ) {
            throw new TeamError(
              400,
              "The Department Head cannot be assigned to a sub-team.",
            )
          }
        }

        const created = await tx.team.create({
          data: {
            name,
            description,
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

        if (memberIds) {
          for (const memberId of memberIds) {
            await updateEmployee(tx, memberId, { teamId: created.id })
          }
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

      return {
        team: {
          ...team,
          memberCount: team._count.employees,
        },
      }
    } catch (error) {
      if (error instanceof EmployeeError) {
        throw new TeamError(error.status, error.message)
      }
      if (isUniqueConflict(error)) {
        throw new TeamError(
          409,
          "A team with that name already exists in this department",
        )
      }
      throw error
    }
  },

  async updateTeam(departmentId: string, teamId: string, body: unknown) {
    const parsed = validateTeamUpdateInput(body)
    if (!parsed.value) {
      throw new TeamError(400, parsed.error)
    }

    const prisma = getPrisma()!
    const existing = await prisma.team.findFirst({
      where: { id: teamId, departmentId },
    })
    if (!existing) {
      throw new TeamError(404, "Team not found")
    }

    const { name, description, leadId } = parsed.value

    try {
      const updated = await prisma.$transaction(async (tx) => {
        if (leadId) {
          await validateTeamLead(tx, departmentId, leadId, teamId, 409)
        }

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

      return {
        team: {
          ...updated,
          memberCount: updated._count.employees,
        },
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new TeamError(
          409,
          "A team with that name already exists in this department",
        )
      }
      throw error
    }
  },

  async deleteTeam(departmentId: string, teamId: string) {
    const prisma = getPrisma()!
    const existing = await prisma.team.findFirst({
      where: { id: teamId, departmentId },
    })
    if (!existing) {
      throw new TeamError(404, "Team not found")
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

    return { message: "Team deleted successfully" }
  },
}
