import { EmployeeStatus, Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { lockRows } from "../../shared/db/locks.js"
import { paginate } from "../../shared/query/pagination.js"
import {
  employeeInclude,
  syncEmployeeForUser,
  updateEmployee,
  EmployeeError,
} from "../employees/employees.service.js"
import type { DepartmentInput } from "./departments.schema.js"
import {
  assertLeadershipCandidate,
  isDepartmentHeadTitle,
  leadershipCandidateWhere,
} from "./leadership.policy.js"

export const departmentMemberSelect = {
  id: true,
  userId: true,
  fullName: true,
  email: true,
  contactNumber: true,
  position: true,
  status: true,
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
      accountDeletedAt: true,
    },
  },
} satisfies Prisma.EmployeeSelect

export function withoutTemporaryHeadTracking<
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

export const departmentsRepository = {
  async listDepartmentsWithCounts() {
    const prisma = getPrisma()!
    return prisma.department.findMany({
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
  },

  /**
   * Leadership candidates for `departmentId` (any department when omitted,
   * unassigned staff only when null, i.e. a department being created), plus
   * current heads (only that department's head when one is given, none for a
   * new department) so an edit form can still show the head it already has.
   */
  async listEligibleHeads(departmentId?: string | null) {
    const prisma = getPrisma()!
    const candidates = {
      ...leadershipCandidateWhere(departmentId),
      leadOfTeam: null,
      headOf: { is: null },
    }
    return prisma.user.findMany({
      where:
        departmentId === null
          ? candidates
          : {
              OR: [
                candidates,
                departmentId
                  ? { headOf: { is: { id: departmentId } } }
                  : { headOf: { isNot: null } },
              ],
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
  },

  async searchAssignableStaff(where: Prisma.UserWhereInput, page: number) {
    return paginate(page, {
      rows: (db, window) =>
        db.user.findMany({
          where,
          select: {
            id: true,
            fullName: true,
            email: true,
            contactNumber: true,
            position: true,
            departmentId: true,
            isActive: true,
            role: true,
            employee: {
              select: { position: true },
            },
          },
          orderBy: [{ fullName: "asc" }, { email: "asc" }, { id: "asc" }],
          ...window,
        }),
      count: (db) => db.user.count({ where }),
    })
  },

  async getDepartmentDetailsWithCleanup(departmentId: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const existing = await tx.department.findUnique({
        where: { id: departmentId },
        select: { id: true, headId: true, temporaryHeadOriginalId: true },
      })
      if (!existing) return null

      // An on-leave original head keeps their title until they return.
      const titleHolderIds = [
        existing.headId,
        existing.temporaryHeadOriginalId,
      ].filter((id): id is string => Boolean(id))
      const titledMembers = await tx.user.findMany({
        where: {
          departmentId,
          id: { notIn: titleHolderIds },
          position: { not: null },
        },
        select: { id: true, position: true },
      })
      const staleMembers = titledMembers.filter((member) =>
        isDepartmentHeadTitle(member.position),
      )
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
  },

  async findById(id: string) {
    const prisma = getPrisma()!
    return prisma.department.findUnique({ where: { id } })
  },

  async createDepartment(data: DepartmentInput) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      if (data.headId)
        await assertLeadershipCandidate(tx, data.headId, {
          kind: "head",
          departmentId: null,
        })
      const created = await tx.department.create({
        data: {
          name: data.name,
          color: data.color,
          code: data.code || null,
          description: data.description || null,
          headId: data.headId,
        },
      })

      if (data.headId) {
        await tx.user.update({
          where: { id: data.headId },
          data: { departmentId: created.id, teamId: null },
        })
        await syncEmployeeForUser(tx, data.headId)
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
  },

  async updateDepartment(
    id: string,
    data: {
      name?: string
      color?: string
      code?: string | null
      description?: string | null
      headId?: string | null
    },
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      await lockRows(tx, "Department", id)
      const current = await tx.department.findUniqueOrThrow({ where: { id } })
      const headChanged =
        data.headId !== undefined && current.headId !== data.headId
      if (headChanged && data.headId)
        await assertLeadershipCandidate(tx, data.headId, {
          kind: "head",
          departmentId: id,
        })
      const saved = await tx.department.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.headId !== undefined ? { headId: data.headId } : {}),
          ...(headChanged
            ? {
                temporaryHeadOriginalId: null,
                temporaryHeadAssignedId: null,
              }
            : {}),
        },
      })

      if (data.headId !== undefined) {
        if (current.headId && current.headId !== data.headId) {
          const oldHead = await tx.user.findUnique({
            where: { id: current.headId },
            select: { id: true, position: true },
          })
          if (oldHead && isDepartmentHeadTitle(oldHead.position)) {
            await tx.user.update({
              where: { id: oldHead.id },
              data: { position: null },
            })
          }
          await syncEmployeeForUser(tx, current.headId)
        }

        if (data.headId) {
          await tx.user.update({
            where: { id: data.headId },
            data: { departmentId: id, teamId: null },
          })
          await syncEmployeeForUser(tx, data.headId)
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
  },

  async deleteDepartment(id: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
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
  },

  async countDepartmentServices(id: string) {
    const prisma = getPrisma()!
    return prisma.service.count({
      where: { departments: { some: { id } } },
    })
  },

  async countDepartmentRequestHistory(id: string) {
    const prisma = getPrisma()!
    const [acceptedRequests, conversations] = await prisma.$transaction([
      prisma.serviceRequest.count({ where: { acceptedDepartmentId: id } }),
      prisma.requestConversation.count({ where: { departmentId: id } }),
    ])
    return acceptedRequests + conversations
  },

  async assignMembers(
    departmentId: string,
    employeeIds?: string[],
    userIds?: string[],
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const requestedEmployeeIds = [...new Set(employeeIds ?? [])]
      if (requestedEmployeeIds.length > 0) {
        const eligibleEmployees = await tx.employee.findMany({
          where: {
            id: { in: requestedEmployeeIds },
            status: EmployeeStatus.ACTIVE,
            OR: [{ departmentId: null }, { departmentId }],
            user: {
              is: {
                role: Role.STAFF,
                isActive: true,
                accountDeletedAt: null,
                OR: [{ departmentId: null }, { departmentId }],
                AND: [
                  {
                    OR: [{ teamId: null }, { team: { is: { departmentId } } }],
                  },
                ],
              },
            },
            AND: [
              {
                OR: [{ teamId: null }, { team: { is: { departmentId } } }],
              },
            ],
          },
          select: { id: true },
        })
        if (eligibleEmployees.length !== requestedEmployeeIds.length) {
          throw new EmployeeError(
            400,
            "Only active staff accounts that are not assigned to another department can be assigned",
          )
        }
      }

      const requestedUserIds = [...new Set(userIds ?? [])]
      if (requestedUserIds.length > 0) {
        const eligibleUsers = await tx.user.findMany({
          where: {
            id: { in: requestedUserIds },
            role: Role.STAFF,
            isActive: true,
            accountDeletedAt: null,
            OR: [{ departmentId: null }, { departmentId }],
            AND: [
              {
                OR: [
                  { employee: { is: null } },
                  {
                    employee: {
                      is: {
                        status: EmployeeStatus.ACTIVE,
                        OR: [{ departmentId: null }, { departmentId }],
                        AND: [
                          {
                            OR: [
                              { teamId: null },
                              { team: { is: { departmentId } } },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              {
                OR: [{ teamId: null }, { team: { is: { departmentId } } }],
              },
            ],
          },
          select: { id: true },
        })
        if (eligibleUsers.length !== requestedUserIds.length) {
          throw new EmployeeError(
            400,
            "Only active staff accounts that are not assigned to another department can be assigned",
          )
        }
      }

      for (const employeeId of requestedEmployeeIds) {
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
          departmentId,
          ...(currentTeam?.departmentId !== departmentId
            ? { teamId: null }
            : {}),
        })
      }

      for (const userId of requestedUserIds) {
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
              departmentId,
              ...(currentTeam?.departmentId !== departmentId
                ? { teamId: null }
                : {}),
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
            departmentId,
            ...(currentTeam?.departmentId !== departmentId
              ? { teamId: null }
              : {}),
          })
        }
      }

      return tx.employee.findMany({
        where: { departmentId },
        include: employeeInclude,
        orderBy: [{ fullName: "asc" }, { employeeId: "asc" }],
      })
    })
  },
}
