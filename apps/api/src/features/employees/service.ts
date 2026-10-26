import { randomUUID } from "node:crypto"
import {
  EmployeeStatus,
  EmploymentType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js"
import type { EmployeeInput } from "./validation.js"

export const employeeInclude = {
  department: { select: { id: true, name: true, code: true } },
  team: { select: { id: true, name: true } },
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.EmployeeInclude

export class EmployeeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "EmployeeError"
  }
}

export type EmployeeWriteInput = EmployeeInput

function generatedEmployeeId() {
  return `EMP-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`
}

function isDepartmentHeadTitle(position: string | null | undefined) {
  const lower = position?.trim().toLowerCase()
  return lower === "dept head" || lower === "department head"
}

async function validateDepartmentAndTeam(
  tx: Prisma.TransactionClient,
  departmentId: string | null | undefined,
  teamId: string | null | undefined,
) {
  if (departmentId) {
    const department = await tx.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    })
    if (!department) throw new EmployeeError(400, "Department not found")
  }
  if (teamId) {
    if (!departmentId) {
      throw new EmployeeError(
        400,
        "Select a department before assigning a team",
      )
    }
    const team = await tx.team.findFirst({
      where: { id: teamId, departmentId },
      select: { id: true },
    })
    if (!team) {
      throw new EmployeeError(
        400,
        "Team does not belong to the selected department",
      )
    }
  }
}

async function assertNoProtectedAssignmentChange(
  tx: Prisma.TransactionClient,
  userId: string,
  nextDepartmentId: string | null,
  nextTeamId: string | null,
) {
  const head = await tx.department.findFirst({
    where: { headId: userId },
    select: { id: true },
  })
  const lead = await tx.team.findFirst({
    where: { leadId: userId },
    select: { id: true },
  })
  if (head && nextDepartmentId !== head.id) {
    throw new EmployeeError(
      409,
      "Reassign this Department Head before changing their employee department or account link",
    )
  }
  if (lead && nextTeamId !== lead.id) {
    throw new EmployeeError(
      409,
      "Reassign this Team Lead before changing their employee team or account link",
    )
  }
}

async function writeEmployee(
  tx: Prisma.TransactionClient,
  id: string | null,
  input: EmployeeWriteInput,
) {
  if (id) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Employee" WHERE "id" = ${id} FOR UPDATE`,
    )
  }
  const existing = id ? await tx.employee.findUnique({ where: { id } }) : null
  if (id && !existing) throw new EmployeeError(404, "Employee not found")

  const nextDepartmentId =
    input.departmentId !== undefined
      ? input.departmentId
      : (existing?.departmentId ?? null)
  const nextTeamId =
    input.teamId !== undefined ? input.teamId : (existing?.teamId ?? null)
  const nextUserId =
    input.userId !== undefined ? input.userId : (existing?.userId ?? null)
  const nextPosition =
    input.position !== undefined ? input.position : (existing?.position ?? null)
  const oldUserId = existing?.userId ?? null

  await validateDepartmentAndTeam(tx, nextDepartmentId, nextTeamId)

  if (isDepartmentHeadTitle(nextPosition)) {
    if (!nextUserId) {
      throw new EmployeeError(
        400,
        "Only the assigned Department Head can have the title 'Department Head'",
      )
    }
    const department = nextDepartmentId
      ? await tx.department.findUnique({
          where: { id: nextDepartmentId },
          select: { headId: true },
        })
      : null
    if (department?.headId !== nextUserId) {
      throw new EmployeeError(
        400,
        "Only the assigned Department Head can have the title 'Department Head'",
      )
    }
  }

  const linkedUserIds = [...new Set([oldUserId, nextUserId].filter(Boolean))]
    .map((userId) => userId as string)
    .sort()
  for (const userId of linkedUserIds) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    )
  }

  let nextUser: { id: string; role: Role } | null = null
  if (nextUserId) {
    nextUser = await tx.user.findUnique({
      where: { id: nextUserId },
      select: { id: true, role: true },
    })
    if (!nextUser) throw new EmployeeError(400, "Selected account not found")
    if (nextUser.role === Role.SUPERADMIN) {
      throw new EmployeeError(
        403,
        "Superadmin accounts cannot be linked to employees",
      )
    }
    const linkedToAnother = await tx.employee.findFirst({
      where: { userId: nextUserId, ...(id ? { id: { not: id } } : {}) },
      select: { id: true },
    })
    if (linkedToAnother) {
      throw new EmployeeError(
        409,
        "This account is already linked to another employee",
      )
    }
  }

  if (nextUserId && nextUser) {
    if (nextDepartmentId && nextTeamId) {
      const department = await tx.department.findUnique({
        where: { id: nextDepartmentId },
        select: { headId: true },
      })
      if (department?.headId === nextUserId) {
        throw new EmployeeError(
          400,
          "The Department Head oversees the entire department and cannot be assigned to a sub-team",
        )
      }
    }
    const accountDepartment = await tx.department.findFirst({
      where: { headId: nextUserId },
      select: { id: true },
    })
    if (accountDepartment && accountDepartment.id !== nextDepartmentId) {
      throw new EmployeeError(
        409,
        "Reassign this Department Head before changing their employee department or account link",
      )
    }
    const accountTeam = await tx.team.findFirst({
      where: { leadId: nextUserId },
      select: { id: true },
    })
    if (accountTeam && accountTeam.id !== nextTeamId) {
      throw new EmployeeError(
        409,
        "Reassign this Team Lead before changing their employee team or account link",
      )
    }
  }

  if (oldUserId && oldUserId !== nextUserId) {
    await assertNoProtectedAssignmentChange(tx, oldUserId, null, null)
  } else if (oldUserId && nextUserId === oldUserId) {
    await assertNoProtectedAssignmentChange(
      tx,
      oldUserId,
      nextDepartmentId ?? null,
      nextTeamId ?? null,
    )
  }

  const data: Prisma.EmployeeUncheckedCreateInput = {
    employeeId:
      input.employeeId ?? existing?.employeeId ?? generatedEmployeeId(),
    fullName: input.fullName ?? existing?.fullName ?? "",
    email: input.email !== undefined ? input.email : (existing?.email ?? null),
    contactNumber:
      input.contactNumber !== undefined
        ? input.contactNumber
        : (existing?.contactNumber ?? null),
    position: nextPosition,
    employmentType:
      input.employmentType ??
      existing?.employmentType ??
      EmploymentType.FULL_TIME,
    status: input.status ?? existing?.status ?? EmployeeStatus.ACTIVE,
    startDate:
      input.startDate !== undefined
        ? input.startDate
        : (existing?.startDate ?? null),
    departmentId: nextDepartmentId,
    teamId: nextTeamId,
    userId: nextUserId,
  }

  const employee = existing
    ? await tx.employee.update({
        where: { id: existing.id },
        data,
        include: employeeInclude,
      })
    : await tx.employee.create({ data, include: employeeInclude })

  if (oldUserId && oldUserId !== nextUserId) {
    await tx.user.update({
      where: { id: oldUserId },
      data: { departmentId: null, teamId: null, position: null },
    })
  }
  if (nextUserId) {
    await tx.user.update({
      where: { id: nextUserId },
      data: {
        departmentId: nextDepartmentId,
        teamId: nextTeamId,
        position: nextPosition,
      },
    })
  }

  return employee
}

export async function createEmployee(
  tx: Prisma.TransactionClient,
  input: EmployeeWriteInput,
) {
  return writeEmployee(tx, null, input)
}

export async function updateEmployee(
  tx: Prisma.TransactionClient,
  id: string,
  data: EmployeeWriteInput,
) {
  return writeEmployee(tx, id, data)
}

export async function syncEmployeeForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude
}> | null> {
  const lockedEmployee = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "Employee" WHERE "userId" = ${userId} FOR UPDATE`,
  )
  if (lockedEmployee.length === 0) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
    )
  }
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      fullName: true,
      contactNumber: true,
      position: true,
      departmentId: true,
      teamId: true,
    },
  })
  if (!user || user.role === Role.SUPERADMIN) return null

  const employee = await tx.employee.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (
    !employee &&
    user.role !== Role.ADMIN &&
    user.role !== Role.STAFF &&
    !user.departmentId &&
    !user.teamId
  ) {
    return null
  }

  const team = user.teamId
    ? await tx.team.findUnique({
        where: { id: user.teamId },
        select: { id: true, departmentId: true },
      })
    : null
  const teamId =
    team && user.departmentId && team.departmentId !== user.departmentId
      ? null
      : (team?.id ?? null)
  const departmentId = user.departmentId ?? team?.departmentId ?? null
  const userAssignmentRepair = {
    ...(team && teamId === null ? { teamId: null } : {}),
    ...(user.departmentId === null && departmentId ? { departmentId } : {}),
  }
  if (Object.keys(userAssignmentRepair).length > 0) {
    await tx.user.update({ where: { id: userId }, data: userAssignmentRepair })
  }
  const assignment = {
    departmentId,
    teamId,
    position: user.position,
  }

  if (employee) {
    return tx.employee.update({
      where: { id: employee.id },
      data: assignment,
      include: employeeInclude,
    })
  }

  return tx.employee.create({
    data: {
      employeeId: generatedEmployeeId(),
      fullName: user.fullName?.trim() || user.email,
      email: user.email,
      contactNumber: user.contactNumber,
      ...assignment,
      userId,
    },
    include: employeeInclude,
  })
}
