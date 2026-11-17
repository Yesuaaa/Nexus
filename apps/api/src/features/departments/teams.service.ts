import { EmployeeStatus, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import {
  syncEmployeeForUser,
  updateEmployee,
} from "../employees/employees.service.js"
import {
  validateTeamCreateInput,
  validateTeamUpdateInput,
} from "./departments.schema.js"
import { assertLeadershipCandidate } from "./leadership.policy.js"
import { HttpError as TeamError } from "../../shared/http-error.js"

/** Feature-named alias of the shared `HttpError`. */
export { TeamError }

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
          await assertLeadershipCandidate(tx, leadId, {
            kind: "lead",
            departmentId,
            conflictStatus: 400,
          })
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
          await assertLeadershipCandidate(tx, leadId, {
            kind: "lead",
            departmentId,
            currentTeamId: teamId,
            conflictStatus: 409,
          })
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
