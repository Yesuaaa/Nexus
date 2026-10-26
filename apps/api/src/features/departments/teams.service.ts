import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import { syncEmployeeForUser } from "../employees/employees.service.js"
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

    const { name, description, leadId } = parsed.value

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
        throw new TeamError(
          400,
          "Reassign the current lead role before assigning this Team Lead.",
        )
      }
    }

    try {
      const team = await prisma.$transaction(async (tx) => {
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
        throw new TeamError(
          409,
          "Reassign the current lead role before assigning this Team Lead.",
        )
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
