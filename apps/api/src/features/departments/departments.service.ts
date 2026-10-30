import { Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import { publicUser } from "../users/users.dto.js"
import {
  EmployeeError,
  syncEmployeeForUser,
  updateEmployee,
} from "../employees/employees.service.js"
import {
  departmentsRepository,
  withoutTemporaryHeadTracking,
} from "./departments.repository.js"
import {
  validateDepartmentCreateInput,
  validateDepartmentUpdateInput,
  validateMemberAssignmentInput,
} from "./departments.schema.js"

export class DepartmentError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "DepartmentError"
  }
}

export const departmentsService = {
  async listDepartments() {
    const departments = await departmentsRepository.listDepartmentsWithCounts()
    return {
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
    }
  },

  async listEligibleHeads() {
    const eligibleUsers = await departmentsRepository.listEligibleHeads()
    return {
      users: eligibleUsers.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        headOf: u.headOf,
      })),
    }
  },

  async getEmployeeOptions(query: { search?: unknown; page?: unknown }) {
    const search =
      query.search === undefined
        ? ""
        : typeof query.search === "string"
          ? query.search.trim()
          : null
    const pageValue = query.page
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
      throw new DepartmentError(400, "Invalid employee filters")
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
    const pageSize = 10
    const [employees, total] =
      await departmentsRepository.searchEmployeeOptions(where, page, pageSize)
    return { employees, total, page, pageSize }
  },

  async getDepartmentById(id: string) {
    const department =
      await departmentsRepository.getDepartmentDetailsWithCleanup(id)
    if (!department) {
      throw new DepartmentError(404, "Department not found")
    }

    const { employees, teams, ...departmentFields } = department

    return {
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
    }
  },

  async createDepartment(body: unknown) {
    const parsed = validateDepartmentCreateInput(body)
    if (!parsed.value) {
      throw new DepartmentError(400, parsed.error)
    }

    const { name, code, description, headId } = parsed.value

    if (headId) {
      const headUser = await departmentsRepository.findUserById(headId)
      if (!headUser) {
        throw new DepartmentError(
          400,
          "Selected department head user not found",
        )
      }
      const teamLead = await departmentsRepository.findTeamLeadByLeadId(headId)
      if (teamLead) {
        throw new DepartmentError(
          409,
          "Reassign this Team Lead before making them a Department Head.",
        )
      }
    }

    try {
      const department = await departmentsRepository.createDepartment({
        name,
        code,
        description,
        headId,
      })
      return {
        department: {
          ...withoutTemporaryHeadTracking(department),
          memberCount: department._count.employees,
        },
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new DepartmentError(409, "Department name or code already exists")
      }
      throw error
    }
  },

  async updateDepartment(id: string, body: unknown) {
    const parsed = validateDepartmentUpdateInput(body)
    if (!parsed.value) {
      throw new DepartmentError(400, parsed.error)
    }

    const existing = await departmentsRepository.findById(id)
    if (!existing) {
      throw new DepartmentError(404, "Department not found")
    }

    const { name, code, description, headId } = parsed.value

    if (headId) {
      const headUser = await departmentsRepository.findUserById(headId)
      if (!headUser) {
        throw new DepartmentError(
          400,
          "Selected department head user not found",
        )
      }
      const teamLead = await departmentsRepository.findTeamLeadByLeadId(headId)
      if (teamLead) {
        throw new DepartmentError(
          409,
          "Reassign this Team Lead before making them a Department Head.",
        )
      }
    }

    try {
      const updated = await departmentsRepository.updateDepartment(id, {
        name,
        code,
        description,
        headId,
      })
      return {
        department: {
          ...withoutTemporaryHeadTracking(updated),
          memberCount: updated._count.employees,
        },
      }
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new DepartmentError(409, "Department name or code already exists")
      }
      throw error
    }
  },

  async assignMembers(id: string, body: unknown) {
    const parsed = validateMemberAssignmentInput(body)
    if (!parsed.value) {
      throw new DepartmentError(400, parsed.error)
    }

    const dept = await departmentsRepository.findById(id)
    if (!dept) {
      throw new DepartmentError(404, "Department not found")
    }

    const { employeeIds, userIds } = parsed.value

    if (userIds !== undefined) {
      const prisma = getPrisma()!
      const eligibleUsers = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          role: Role.STAFF,
          isActive: true,
          accountDeletedAt: null,
        },
        select: { id: true },
      })
      if (eligibleUsers.length !== userIds.length) {
        throw new DepartmentError(
          400,
          "Only active staff accounts can be assigned to a department",
        )
      }
    }

    try {
      const updatedMembers = await departmentsRepository.assignMembers(
        id,
        employeeIds,
        userIds,
      )
      return {
        message: "Members assigned successfully",
        members: updatedMembers,
      }
    } catch (error) {
      if (error instanceof EmployeeError) {
        throw new DepartmentError(error.status, error.message)
      }
      throw error
    }
  },

  async removeMember(id: string, memberId: string) {
    const prisma = getPrisma()!
    const dept = await prisma.department.findUnique({ where: { id } })
    if (!dept) {
      throw new DepartmentError(404, "Department not found")
    }

    const employee = await prisma.employee.findFirst({
      where: { id: memberId, departmentId: id },
      select: { id: true, userId: true },
    })

    if (employee) {
      if (dept.headId !== null && dept.headId === employee.userId) {
        throw new DepartmentError(
          400,
          "Cannot remove the Department Head from members. To remove or replace the head, use Edit Department.",
        )
      }
      try {
        await prisma.$transaction((tx) =>
          updateEmployee(tx, employee.id, {
            departmentId: null,
            teamId: null,
          }),
        )
        return { message: "Employee removed from department" }
      } catch (error) {
        if (error instanceof EmployeeError) {
          throw new DepartmentError(error.status, error.message)
        }
        throw error
      }
    }

    const user = await prisma.user.findFirst({
      where: { id: memberId, departmentId: id },
      select: { id: true },
    })
    if (!user) {
      throw new DepartmentError(404, "Member not found")
    }
    if (dept.headId !== null && dept.headId === user.id) {
      throw new DepartmentError(
        400,
        "Cannot remove the Department Head from members. To remove or replace the head, use Edit Department.",
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { departmentId: null, teamId: null },
      })
      await syncEmployeeForUser(tx, user.id)
    })
    return { message: "Employee removed from department" }
  },

  async updateMember(
    departmentId: string,
    memberId: string,
    body: { position?: unknown; teamId?: unknown },
  ) {
    const position =
      body.position !== undefined
        ? typeof body.position === "string" && body.position.trim()
          ? body.position.trim()
          : null
        : undefined
    const teamId =
      body.teamId !== undefined
        ? typeof body.teamId === "string" && body.teamId.trim()
          ? body.teamId.trim()
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
      throw new DepartmentError(
        400,
        "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      )
    }

    const user = employee
      ? null
      : await prisma.user.findFirst({
          where: { id: memberId, departmentId },
        })
    if (!employee && !user) {
      throw new DepartmentError(404, "Member not found in this department")
    }
    if (user && teamId && user.role !== Role.STAFF) {
      throw new DepartmentError(
        400,
        "Only staff accounts can be assigned to a team",
      )
    }
    if (user && dept?.headId && dept.headId === user.id && teamId) {
      throw new DepartmentError(
        400,
        "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      )
    }

    if (position !== undefined && position !== null) {
      const lower = position.toLowerCase()
      if (
        (dept?.headId == null ||
          dept.headId !== (employee?.userId ?? user?.id)) &&
        (lower === "dept head" || lower === "department head")
      ) {
        throw new DepartmentError(
          400,
          "Only the assigned Department Head can have the title 'Department Head'. For regular members, please specify their job title (e.g. Specialist, Analyst, Coordinator).",
        )
      }
    }

    if (teamId) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, departmentId },
      })
      if (!team) {
        throw new DepartmentError(400, "Team not found in this department")
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
        return { employee: updated }
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

      return { user: publicUser(updated) }
    } catch (error) {
      if (error instanceof EmployeeError) {
        throw new DepartmentError(error.status, error.message)
      }
      throw error
    }
  },

  async deleteDepartment(id: string) {
    const dept = await departmentsRepository.findById(id)
    if (!dept) {
      throw new DepartmentError(404, "Department not found")
    }

    const serviceCount = await departmentsRepository.countDepartmentServices(id)
    if (serviceCount > 0) {
      throw new DepartmentError(
        409,
        "Reassign or remove this department's services before deleting the department",
      )
    }

    await departmentsRepository.deleteDepartment(id)
    return { message: "Department deleted successfully" }
  },
}
