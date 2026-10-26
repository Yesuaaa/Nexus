import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import {
  employeeInclude,
  syncEmployeeForUser,
  updateEmployee,
  EmployeeError,
} from "../employees/employees.service.js"
import type { DepartmentInput } from "./departments.schema.js"

export const departmentMemberSelect = {
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

  async listEligibleHeads() {
    const prisma = getPrisma()!
    return prisma.user.findMany({
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
  },

  async searchEmployeeOptions(
    where: Prisma.EmployeeWhereInput,
    page: number,
    pageSize: number,
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction([
      prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ fullName: "asc" }, { employeeId: "asc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ])
  },

  async getDepartmentDetailsWithCleanup(departmentId: string) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
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
  },

  async findById(id: string) {
    const prisma = getPrisma()!
    return prisma.department.findUnique({ where: { id } })
  },

  async findUserById(id: string) {
    const prisma = getPrisma()!
    return prisma.user.findUnique({ where: { id } })
  },

  async findTeamLeadByLeadId(leadId: string) {
    const prisma = getPrisma()!
    return prisma.team.findFirst({
      where: { leadId },
      select: { id: true },
    })
  },

  async createDepartment(data: DepartmentInput) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      const created = await tx.department.create({
        data: {
          name: data.name,
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
      code?: string | null
      description?: string | null
      headId?: string | null
    },
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Department" WHERE "id" = ${id} FOR UPDATE`,
      )
      const current = await tx.department.findUniqueOrThrow({ where: { id } })
      const headChanged =
        data.headId !== undefined && current.headId !== data.headId
      const saved = await tx.department.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
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

  async assignMembers(
    departmentId: string,
    employeeIds?: string[],
    userIds?: string[],
  ) {
    const prisma = getPrisma()!
    return prisma.$transaction(async (tx) => {
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
          departmentId,
          ...(currentTeam?.departmentId !== departmentId
            ? { teamId: null }
            : {}),
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
