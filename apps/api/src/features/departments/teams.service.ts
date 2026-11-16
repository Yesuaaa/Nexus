import { EmployeeStatus, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import { lockRows } from "../../shared/db/locks.js"
import {
  readEmployeeMemberState,
  readUserMemberState,
  writeDepartmentMemberChanges,
  type MemberState,
} from "./department-member-history.js"
import {
  teamHistorySelect,
  rememberTeamMember,
  recordTeamChanges,
  readTeamDeletionState,
} from "./team-management-history.js"
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
  async createTeam(
    departmentId: string,
    body: unknown,
    operation: ManagementOperation,
  ) {
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
        const states = new Map<string, MemberState>()
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
          rememberTeamMember(
            states,
            await readUserMemberState(tx, leadId, true),
          )
          await tx.user.update({
            where: { id: leadId },
            data: { departmentId, teamId: created.id },
          })
          await syncEmployeeForUser(tx, leadId)
        }

        if (memberIds) {
          for (const memberId of memberIds) {
            rememberTeamMember(
              states,
              await readEmployeeMemberState(tx, memberId),
            )
            await updateEmployee(tx, memberId, { teamId: created.id })
          }
        }

        for (const before of states.values())
          await writeDepartmentMemberChanges(
            tx,
            operation,
            before,
            "TEAM_MANAGEMENT",
          )
        await recordTeamChanges(tx, operation, null, created)

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

  async updateTeam(
    departmentId: string,
    teamId: string,
    body: unknown,
    operation: ManagementOperation,
  ) {
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
        const states = new Map<string, MemberState>()
        if (leadId) {
          await assertLeadershipCandidate(tx, leadId, {
            kind: "lead",
            departmentId,
            currentTeamId: teamId,
            conflictStatus: 409,
          })
        }

        // Same point as the existing UPDATE lock, after candidate User checks.
        await lockRows(tx, "Team", teamId)
        const beforeTeam = await tx.team.findFirstOrThrow({
          where: { id: teamId, departmentId },
          select: teamHistorySelect,
        })
        const saved = await tx.team.update({
          where: { id: teamId },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(leadId !== undefined ? { leadId } : {}),
          },
        })

        if (beforeTeam.leadId && beforeTeam.leadId !== leadId) {
          rememberTeamMember(
            states,
            await readUserMemberState(tx, beforeTeam.leadId, false),
          )
          await syncEmployeeForUser(tx, beforeTeam.leadId)
        }

        if (leadId) {
          rememberTeamMember(
            states,
            await readUserMemberState(tx, leadId, true),
          )
          await tx.user.update({
            where: { id: leadId },
            data: { departmentId, teamId },
          })
          await syncEmployeeForUser(tx, leadId)
        }

        for (const before of states.values())
          await writeDepartmentMemberChanges(
            tx,
            operation,
            before,
            "TEAM_MANAGEMENT",
          )
        await recordTeamChanges(tx, operation, beforeTeam, saved)

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

  async deleteTeam(
    departmentId: string,
    teamId: string,
    operation: ManagementOperation,
  ) {
    const prisma = getPrisma()!
    const existing = await prisma.team.findFirst({
      where: { id: teamId, departmentId },
    })
    if (!existing) {
      throw new TeamError(404, "Team not found")
    }

    await prisma.$transaction(async (tx) => {
      const before = await readTeamDeletionState(tx, departmentId, teamId)
      await tx.user.updateMany({
        where: { teamId },
        data: { teamId: null },
      })
      await tx.employee.updateMany({
        where: { teamId },
        data: { teamId: null },
      })
      for (const userId of before.syncUserIds) {
        await syncEmployeeForUser(tx, userId)
      }
      await tx.team.delete({ where: { id: teamId } })
      for (const state of before.states.values())
        await writeDepartmentMemberChanges(
          tx,
          operation,
          state,
          "TEAM_MANAGEMENT",
        )
      await recordTeamChanges(tx, operation, before.team, null)
    })

    return { message: "Team deleted successfully" }
  },
}
