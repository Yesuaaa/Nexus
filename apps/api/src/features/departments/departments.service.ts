import { EmployeeStatus, Prisma, Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { isUniqueConflict } from "../../lib/errors.js"
import { publicUser, publicUserInclude } from "../users/users.dto.js"
import {
  syncEmployeeForUser,
  updateEmployee,
} from "../employees/employees.service.js"
import { insensitive, parsePage } from "../../shared/query/pagination.js"
import { isRecordId } from "../../shared/validation.js"
import {
  departmentsRepository,
  withoutTemporaryHeadTracking,
} from "./departments.repository.js"
import { assertDepartmentHeadTitle } from "./leadership.policy.js"
import {
  validateDepartmentCreateInput,
  validateDepartmentUpdateInput,
  validateMemberAssignmentInput,
} from "./departments.schema.js"
import { HttpError as DepartmentError } from "../../shared/http-error.js"

/** Feature-named alias of the shared `HttpError`. */
export { DepartmentError }

export const departmentsService = {
  async listDepartments() {
    const departments = await departmentsRepository.listDepartmentsWithCounts()
    return {
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        color: d.color,
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

  /**
   * `?departmentId=<id>` scopes candidates to an existing department;
   * `?new=true` lists only unassigned staff (for a department being created).
   */
  async listEligibleHeads(
    query: { departmentId?: unknown; new?: unknown } = {},
  ) {
    const departmentId = query.departmentId
    const forNew = query.new
    if (
      (departmentId !== undefined && !isRecordId(departmentId)) ||
      (forNew !== undefined && forNew !== "true") ||
      (departmentId !== undefined && forNew !== undefined)
    ) {
      throw new DepartmentError(400, "Invalid department filter")
    }
    const eligibleUsers = await departmentsRepository.listEligibleHeads(
      forNew === "true" ? null : departmentId,
    )
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
    const page = parsePage(query.page)
    if (search === null || search.length > 100 || page === null) {
      throw new DepartmentError(400, "Invalid employee filters")
    }

    const where: Prisma.UserWhereInput = {
      role: Role.STAFF,
      isActive: true,
      accountDeletedAt: null,
      departmentId: null,
      teamId: null,
      AND: [
        {
          OR: [
            { employee: { is: null } },
            {
              employee: {
                is: {
                  status: EmployeeStatus.ACTIVE,
                  departmentId: null,
                  teamId: null,
                },
              },
            },
          ],
        },
        insensitive<Prisma.UserWhereInput>(search, [
          "fullName",
          "email",
          "contactNumber",
          () => ({
            employee: {
              is: insensitive<Prisma.EmployeeWhereInput>(search, [
                "employeeId",
                "fullName",
                "email",
                "contactNumber",
              ]),
            },
          }),
        ]),
      ],
    }
    const { rows, ...result } =
      await departmentsRepository.searchAssignableStaff(where, page)
    return {
      employees: rows.map((user) => ({
        id: user.id,
        fullName: user.fullName?.trim() || user.email,
        email: user.email,
        contactNumber: user.contactNumber,
        position: user.employee?.position ?? user.position,
        departmentId: user.departmentId,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
        },
      })),
      ...result,
    }
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

    const { name, color, code, description, headId } = parsed.value

    try {
      // The head is checked against the leadership policy inside the write.
      const department = await departmentsRepository.createDepartment({
        name,
        color,
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

    const { name, color, code, description, headId } = parsed.value

    try {
      // A new head is checked against the leadership policy inside the write.
      const updated = await departmentsRepository.updateDepartment(id, {
        name,
        color,
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

    const updatedMembers = await departmentsRepository.assignMembers(
      id,
      employeeIds,
      userIds,
    )
    return {
      message: "Members assigned successfully",
      members: updatedMembers,
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
      await prisma.$transaction((tx) =>
        updateEmployee(tx, employee.id, {
          departmentId: null,
          teamId: null,
        }),
      )
      return { message: "Employee removed from department" }
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
      select: {
        id: true,
        userId: true,
        status: true,
        user: {
          select: {
            role: true,
            isActive: true,
            accountDeletedAt: true,
          },
        },
      },
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
    if (
      teamId &&
      employee &&
      (employee.status !== EmployeeStatus.ACTIVE ||
        employee.user?.role !== Role.STAFF ||
        !employee.user.isActive ||
        employee.user.accountDeletedAt !== null)
    ) {
      throw new DepartmentError(
        400,
        "Only active staff accounts can be assigned to a team",
      )
    }
    if (
      teamId &&
      user &&
      (user.role !== Role.STAFF ||
        !user.isActive ||
        user.accountDeletedAt !== null)
    ) {
      throw new DepartmentError(
        400,
        "Only active staff accounts can be assigned to a team",
      )
    }
    if (user && dept?.headId && dept.headId === user.id && teamId) {
      throw new DepartmentError(
        400,
        "The Department Head oversees the entire department and cannot be assigned to a sub-team",
      )
    }

    if (teamId) {
      const team = await prisma.team.findFirst({
        where: { id: teamId, departmentId },
      })
      if (!team) {
        throw new DepartmentError(400, "Team not found in this department")
      }
    }

    // updateEmployee applies the "Department Head" title rule in its write.
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
      if (position !== undefined)
        await assertDepartmentHeadTitle(tx, {
          title: position,
          userId: user!.id,
          departmentId,
          currentTitle: user!.position,
        })
      const saved = await tx.user.update({
        where: { id: user!.id },
        data: {
          ...(position !== undefined ? { position } : {}),
          ...(teamId !== undefined ? { teamId } : {}),
        },
        include: publicUserInclude,
      })
      await syncEmployeeForUser(tx, saved.id)
      return saved
    })

    return { user: publicUser(updated) }
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

    const requestHistoryCount =
      await departmentsRepository.countDepartmentRequestHistory(id)
    if (requestHistoryCount > 0) {
      throw new DepartmentError(
        409,
        "This department has client request history and can't be deleted",
      )
    }

    await departmentsRepository.deleteDepartment(id)
    return { message: "Department deleted successfully" }
  },
}
