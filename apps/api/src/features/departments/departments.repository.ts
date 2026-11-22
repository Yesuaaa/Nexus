import { EmployeeStatus, Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  readEmployeeMemberState,
  readUserMemberState,
  writeDepartmentMemberChanges,
  type MemberState,
} from "./department-member-history.js"
import {
  readDepartmentDeletionWorkforce,
  writeDepartmentDeletionWorkforce,
} from "./department-deletion-history.js"
import type { ManagementOperation } from "../../shared/management-history.js"
import {
  recordDepartmentChanges,
  synchronizeDepartmentEmployee,
  userUpdateSelect,
} from "./department-management-history.js"
import { readTransaction } from "../../lib/database-read.js"
import { lockRows } from "../../shared/db/locks.js"
import { paginate } from "../../shared/query/pagination.js"
import { departmentSummarySelect } from "../../shared/query/selects.js"
import { notifyPendingLeaveAfterHeadChange } from "../leave/leave.repository.js"
import { notifyPendingAdjustmentsAfterHeadChange } from "../attendance/attendance.pending-notifications.js"
import { beginAttendancePlacement } from "../employees/attendance-placement-history.js"
import {
  employeeInclude,
  clearFormerDepartmentHeadTitle,
  syncEmployeeForUser,
  updateEmployee,
  EmployeeError,
} from "../employees/employees.service.js"
import type { DepartmentInput } from "./departments.schema.js"
import {
  assertLeadershipCandidate,
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

const departmentListInclude = {
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
} satisfies Prisma.DepartmentInclude

async function findDepartmentsWithCounts() {
  const prisma = getPrisma()!
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: departmentListInclude,
  })
}

async function countProjectsByDepartmentIds(departmentIds: string[]) {
  if (!departmentIds.length) return new Map<string, number>()
  const prisma = getPrisma()!
  const counts = await prisma.$queryRaw<
    { departmentId: string; projectCount: number }[]
  >(Prisma.sql`
    SELECT r."acceptedDepartmentId" AS "departmentId",
      COUNT(DISTINCT p.id)::int AS "projectCount"
    FROM "Project" p
    INNER JOIN "ServiceRequest" r ON r.id = p."requestId"
    WHERE r."acceptedDepartmentId" IN (${Prisma.join(departmentIds)})
    GROUP BY r."acceptedDepartmentId"
  `)
  return new Map(
    counts.map(({ departmentId, projectCount }) => [
      departmentId,
      projectCount,
    ]),
  )
}

export const departmentsRepository = {
  async listDepartmentDirectory() {
    // Cross-department coordination needs identifiers and Head names, not HR
    // records, contacts, membership counts or account lifecycle information.
    return getPrisma()!.department.findMany({
      select: {
        ...departmentSummarySelect,
        head: { select: { id: true, fullName: true } },
      },
      orderBy: { name: "asc" },
    })
  },

  async listDepartmentsWithCounts() {
    return findDepartmentsWithCounts()
  },

  async listProjectManagementDepartmentsWithCounts() {
    const departments = await findDepartmentsWithCounts()
    const projectCounts = await countProjectsByDepartmentIds(
      departments.map(({ id }) => id),
    )
    return departments.map((department) => ({
      ...department,
      projectCount: projectCounts.get(department.id) ?? 0,
    }))
  },

  async getProjectManagementDepartmentDetails(departmentId: string) {
    const prisma = getPrisma()!
    const [department, projectCounts] = await Promise.all([
      prisma.department.findUnique({
        where: { id: departmentId },
        select: {
          id: true,
          name: true,
          color: true,
          code: true,
          description: true,
          headId: true,
          createdAt: true,
          updatedAt: true,
          head: {
            select: {
              id: true,
              fullName: true,
              role: true,
              position: true,
            },
          },
          employees: {
            select: {
              id: true,
              userId: true,
              fullName: true,
              position: true,
              user: {
                select: { id: true, fullName: true, role: true },
              },
            },
            orderBy: [{ fullName: "asc" }, { employeeId: "asc" }],
          },
        },
      }),
      countProjectsByDepartmentIds([departmentId]),
    ])
    if (!department) return null
    return {
      ...department,
      members: department.employees,
      memberCount: department.employees.length,
      projectCount: projectCounts.get(departmentId) ?? 0,
    }
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

  async getDepartmentDetails(departmentId: string) {
    // Read the department and its relations from one snapshot. No HR repairs.
    return readTransaction((tx) =>
      tx.department.findUnique({
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
      }),
    )
  },

  async findById(id: string) {
    const prisma = getPrisma()!
    return prisma.department.findUnique({ where: { id } })
  },

  async createDepartment(
    data: DepartmentInput,
    operation: ManagementOperation,
  ) {
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
        const beforeUser = await tx.user.findUniqueOrThrow({
          where: { id: data.headId },
          select: userUpdateSelect,
        })
        await tx.user.update({
          where: { id: data.headId },
          data: { departmentId: created.id, teamId: null },
        })
        await synchronizeDepartmentEmployee(
          tx,
          operation,
          data.headId,
          beforeUser,
        )
      }

      await recordDepartmentChanges(tx, operation, null, created)

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
    operation: ManagementOperation,
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
        if (headChanged) {
          // An explicit replacement also ends a reserved original Head's tenure.
          const formerIds = new Set([
            current.headId,
            current.temporaryHeadOriginalId,
          ])
          for (const formerId of [...formerIds]
            .filter(
              (userId): userId is string =>
                Boolean(userId) && userId !== data.headId,
            )
            .sort()) {
            await clearFormerDepartmentHeadTitle(tx, formerId, {
              operation,
              departmentId: id,
              origin: "DEPARTMENT_MANAGEMENT",
            })
            await synchronizeDepartmentEmployee(tx, operation, formerId)
          }
        }

        if (data.headId) {
          // The changed candidate is locked by eligibility; unchanged Heads
          // previously acquired this same User lock via the UPDATE below.
          await lockRows(tx, "User", data.headId)
          const beforeUser = await tx.user.findUniqueOrThrow({
            where: { id: data.headId },
            select: userUpdateSelect,
          })
          await tx.user.update({
            where: { id: data.headId },
            data: { departmentId: id, teamId: null },
          })
          await synchronizeDepartmentEmployee(
            tx,
            operation,
            data.headId,
            beforeUser,
          )
        }
      }

      await recordDepartmentChanges(tx, operation, current, saved)
      if (headChanged) {
        await notifyPendingLeaveAfterHeadChange(tx, id)
        await notifyPendingAdjustmentsAfterHeadChange(tx, id)
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

  async deleteDepartment(id: string, operation: ManagementOperation) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const before = await readDepartmentDeletionWorkforce(tx, id)
      await tx.user.updateMany({
        where: { departmentId: id },
        data: { departmentId: null, teamId: null },
      })
      await beginAttendancePlacement(tx, operation)
      await tx.employee.updateMany({
        where: { departmentId: id },
        data: { departmentId: null, teamId: null },
      })
      for (const userId of before.syncUserIds) {
        await syncEmployeeForUser(tx, userId, operation)
      }
      await tx.department.delete({ where: { id } })
      await writeDepartmentDeletionWorkforce(tx, operation, before)
    })
  },

  async assignMembers(
    departmentId: string,
    employeeIds: string[] | undefined,
    userIds: string[] | undefined,
    operation: ManagementOperation,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const beforeStates = new Map<string, MemberState>()
      const remember = (state: MemberState) => {
        const key = state.user
          ? `user:${state.user.id}`
          : `employee:${state.employee!.id}`
        if (!beforeStates.has(key)) beforeStates.set(key, state)
      }
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
        remember(await readEmployeeMemberState(tx, employee.id))
        await updateEmployee(
          tx,
          employee.id,
          {
            departmentId,
            ...(currentTeam?.departmentId !== departmentId
              ? { teamId: null }
              : {}),
          },
          { operation, placementOnly: true },
        )
      }

      for (const userId of requestedUserIds) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, teamId: true },
        })
        if (!user) {
          throw new EmployeeError(404, "User not found")
        }
        remember(await readUserMemberState(tx, user.id, false))
        await syncEmployeeForUser(tx, user.id, operation)
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
          await syncEmployeeForUser(tx, user.id, operation)
        } else {
          const currentTeam = employee.teamId
            ? await tx.team.findUnique({
                where: { id: employee.teamId },
                select: { departmentId: true },
              })
            : null
          await updateEmployee(
            tx,
            employee.id,
            {
              departmentId,
              ...(currentTeam?.departmentId !== departmentId
                ? { teamId: null }
                : {}),
            },
            { operation, placementOnly: true },
          )
        }
      }

      for (const before of beforeStates.values())
        await writeDepartmentMemberChanges(tx, operation, before)
      return tx.employee.findMany({
        where: { departmentId },
        include: employeeInclude,
        orderBy: [{ fullName: "asc" }, { employeeId: "asc" }],
      })
    })
  },
}
