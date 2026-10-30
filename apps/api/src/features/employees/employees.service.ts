import { randomUUID } from "node:crypto"
import {
  EmployeeStatus,
  EmploymentType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js"
import { validPassword } from "../auth/auth.password.js"
import { employeeInclude } from "./employees.repository.js"
import type { EmployeeInput } from "./employees.schema.js"

export { employeeInclude }

export class EmployeeError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "EmployeeError"
  }
}

export type EmployeeWriteInput = EmployeeInput & { userId?: string | null }

const departmentHeadCandidateSelect = {
  id: true,
  employeeId: true,
  fullName: true,
  startDate: true,
  createdAt: true,
  departmentId: true,
  status: true,
  userId: true,
  user: {
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      headOf: { select: { id: true } },
      leadOfTeam: { select: { id: true } },
    },
  },
} satisfies Prisma.EmployeeSelect

type DepartmentHeadCandidate = Prisma.EmployeeGetPayload<{
  select: typeof departmentHeadCandidateSelect
}>

function compareSeniority(
  left: DepartmentHeadCandidate,
  right: DepartmentHeadCandidate,
) {
  if (left.startDate && right.startDate) {
    const startDateDifference =
      left.startDate.getTime() - right.startDate.getTime()
    if (startDateDifference !== 0) return startDateDifference
  } else if (left.startDate) {
    return -1
  } else if (right.startDate) {
    return 1
  }

  const createdAtDifference =
    left.createdAt.getTime() - right.createdAt.getTime()
  if (createdAtDifference !== 0) return createdAtDifference
  return (
    left.employeeId.localeCompare(right.employeeId) ||
    left.id.localeCompare(right.id)
  )
}

async function listDepartmentHeadCandidates(
  tx: Prisma.TransactionClient,
  departmentId: string,
  excludingUserId: string,
) {
  const candidates = await tx.employee.findMany({
    where: {
      departmentId,
      status: EmployeeStatus.ACTIVE,
      userId: { not: excludingUserId },
      user: {
        is: {
          role: Role.STAFF,
          isActive: true,
          headOf: null,
          leadOfTeam: null,
        },
      },
    },
    select: departmentHeadCandidateSelect,
  })
  return candidates.sort(compareSeniority)
}

export function validEmployeeAccountPassword(value: unknown): value is string {
  return (
    validPassword(value) &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  )
}

export function withoutEmployeeAccountDetails<
  T extends {
    userId: string | null
    user?: { isActive: boolean; accountDeletedAt: Date | null } | null
  },
>(record: T) {
  const { userId: omittedUserId, user: omittedUser, ...employee } = record
  const hasAccount = Boolean(omittedUserId && !omittedUser?.accountDeletedAt)
  const accountIsActive = hasAccount ? (omittedUser?.isActive ?? false) : null
  return { ...employee, hasAccount, accountIsActive }
}

export async function createStaffAccount(
  tx: Prisma.TransactionClient,
  employee: {
    email: string | null
    fullName: string
    contactNumber: string | null
    position: string | null
    departmentId: string | null
    teamId: string | null
  },
  passwordHash: string,
) {
  if (!employee.email) {
    throw new EmployeeError(400, "Email is required to create an account")
  }
  return tx.user.create({
    data: {
      email: employee.email,
      fullName: employee.fullName,
      contactNumber: employee.contactNumber,
      position: employee.position,
      passwordHash,
      role: Role.STAFF,
      isActive: true,
      departmentId: employee.departmentId,
      teamId: employee.teamId,
    },
  })
}

export async function getEmployeeStatusOptions(
  tx: Prisma.TransactionClient,
  employeeId: string,
) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true, userId: true },
  })
  if (!employee) throw new EmployeeError(404, "Employee not found")

  const department = employee.userId
    ? await tx.department.findUnique({
        where: { headId: employee.userId },
        select: {
          id: true,
          headId: true,
          temporaryHeadOriginalId: true,
          temporaryHeadAssignedId: true,
        },
      })
    : null
  const isDepartmentHead = Boolean(employee.userId && department)
  const candidates =
    isDepartmentHead && department && employee.userId
      ? await listDepartmentHeadCandidates(tx, department.id, employee.userId)
      : []

  return {
    isDepartmentHead,
    replacementCandidates: candidates.map((candidate) => ({
      id: candidate.id,
      employeeId: candidate.employeeId,
      fullName: candidate.fullName,
      email: candidate.user?.email ?? null,
      startDate: candidate.startDate,
    })),
    recommendedReplacementEmployeeId: candidates[0]?.id ?? null,
    willRestoreOriginalHead: Boolean(
      employee.userId &&
      department?.temporaryHeadOriginalId === employee.userId &&
      department.headId === department.temporaryHeadAssignedId,
    ),
  }
}

function generatedEmployeeId() {
  return `EXP-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`
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
      "Reassign this Department Head before changing their employee department",
    )
  }
  if (lead && nextTeamId !== lead.id) {
    throw new EmployeeError(
      409,
      "Reassign this Team Lead before changing their employee team",
    )
  }
}

async function writeEmployee(
  tx: Prisma.TransactionClient,
  id: string | null,
  input: EmployeeWriteInput,
) {
  let statusSnapshot: {
    departmentId: string | null
    userId: string | null
  } | null = null
  if (id) {
    const snapshot = await tx.employee.findUnique({ where: { id } })
    if (!snapshot) throw new EmployeeError(404, "Employee not found")
    statusSnapshot = {
      departmentId: snapshot.departmentId,
      userId: snapshot.userId,
    }

    if (input.status !== undefined) {
      const departmentIds = new Set<string>()
      if (snapshot.departmentId) departmentIds.add(snapshot.departmentId)
      if (snapshot.userId) {
        const headedDepartment = await tx.department.findUnique({
          where: { headId: snapshot.userId },
          select: { id: true },
        })
        if (headedDepartment) departmentIds.add(headedDepartment.id)
        const temporaryDepartments = await tx.department.findMany({
          where: { temporaryHeadOriginalId: snapshot.userId },
          select: { id: true },
        })
        for (const department of temporaryDepartments)
          departmentIds.add(department.id)
      }
      for (const departmentId of [...departmentIds].sort()) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Department" WHERE "id" = ${departmentId} FOR UPDATE`,
        )
      }
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Employee" WHERE "id" = ${id} FOR UPDATE`,
    )
  }
  const existing = id ? await tx.employee.findUnique({ where: { id } }) : null
  if (id && !existing) throw new EmployeeError(404, "Employee not found")
  if (
    input.status !== undefined &&
    existing &&
    statusSnapshot &&
    (existing.departmentId !== statusSnapshot.departmentId ||
      existing.userId !== statusSnapshot.userId)
  ) {
    throw new EmployeeError(
      409,
      "Employee assignment changed; refresh and retry",
    )
  }

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
  const statusChanged = Boolean(
    existing && input.status !== undefined && input.status !== existing.status,
  )

  await validateDepartmentAndTeam(tx, nextDepartmentId, nextTeamId)

  const currentDepartment =
    statusChanged && oldUserId
      ? await tx.department.findUnique({
          where: { headId: oldUserId },
          select: {
            id: true,
            headId: true,
            temporaryHeadOriginalId: true,
            temporaryHeadAssignedId: true,
          },
        })
      : null
  const isDepartmentHeadLeaving = Boolean(
    statusChanged &&
    input.status !== EmployeeStatus.ACTIVE &&
    oldUserId &&
    currentDepartment?.headId === oldUserId,
  )
  if (input.replacementHeadEmployeeId && !isDepartmentHeadLeaving) {
    throw new EmployeeError(
      400,
      "A temporary Department Head can only be selected when the current head changes to a non-active status",
    )
  }

  let replacementHeadCandidate: DepartmentHeadCandidate | null = null
  if (isDepartmentHeadLeaving && currentDepartment && oldUserId) {
    const candidates = await listDepartmentHeadCandidates(
      tx,
      currentDepartment.id,
      oldUserId,
    )
    replacementHeadCandidate = input.replacementHeadEmployeeId
      ? (candidates.find(
          (candidate) => candidate.id === input.replacementHeadEmployeeId,
        ) ?? null)
      : (candidates[0] ?? null)
    if (!replacementHeadCandidate) {
      throw new EmployeeError(
        input.replacementHeadEmployeeId ? 400 : 409,
        input.replacementHeadEmployeeId
          ? "Choose an active Staff member with an EXP account in this department"
          : "No active Staff member with an EXP account is available to temporarily lead this department",
      )
    }
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Employee" WHERE "id" = ${replacementHeadCandidate.id} FOR UPDATE`,
    )
    const refreshedCandidate = await tx.employee.findUnique({
      where: { id: replacementHeadCandidate.id },
      select: departmentHeadCandidateSelect,
    })
    if (
      !refreshedCandidate ||
      refreshedCandidate.departmentId !== currentDepartment.id ||
      refreshedCandidate.status !== EmployeeStatus.ACTIVE ||
      refreshedCandidate.userId !== replacementHeadCandidate.userId
    ) {
      throw new EmployeeError(
        409,
        "The selected temporary head changed; refresh and choose again",
      )
    }
    replacementHeadCandidate = refreshedCandidate
  }

  const returningDepartment =
    statusChanged && input.status === EmployeeStatus.ACTIVE && oldUserId
      ? await tx.department.findFirst({
          where: { temporaryHeadOriginalId: oldUserId },
          select: {
            id: true,
            headId: true,
            temporaryHeadOriginalId: true,
            temporaryHeadAssignedId: true,
          },
        })
      : null

  const originalTemporaryDepartment =
    oldUserId &&
    existing &&
    nextDepartmentId &&
    isDepartmentHeadTitle(nextPosition)
      ? await tx.department.findFirst({
          where: {
            id: nextDepartmentId,
            temporaryHeadOriginalId: oldUserId,
          },
          select: { id: true },
        })
      : null

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
    const unchangedTemporaryHeadTitle = Boolean(
      existing?.position === nextPosition && originalTemporaryDepartment,
    )
    if (department?.headId !== nextUserId && !unchangedTemporaryHeadTitle) {
      throw new EmployeeError(
        400,
        "Only the assigned Department Head can have the title 'Department Head'",
      )
    }
  }

  const linkedUserIds = [
    ...new Set(
      [oldUserId, nextUserId, replacementHeadCandidate?.userId].filter(
        (userId): userId is string => Boolean(userId),
      ),
    ),
  ].sort()
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
    if (!nextUser) throw new EmployeeError(400, "Employee account not found")
    if (nextUser.role === Role.SUPERADMIN) {
      throw new EmployeeError(
        403,
        "Superadmin accounts cannot have employee records",
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
        "Reassign this Department Head before changing their employee department",
      )
    }
    const accountTeam = await tx.team.findFirst({
      where: { leadId: nextUserId },
      select: { id: true },
    })
    if (accountTeam && accountTeam.id !== nextTeamId) {
      throw new EmployeeError(
        409,
        "Reassign this Team Lead before changing their employee team",
      )
    }
  }

  if (isDepartmentHeadLeaving && currentDepartment && oldUserId) {
    const replacementHead = replacementHeadCandidate
    const candidateUserId = replacementHead?.userId
    if (!replacementHead || !candidateUserId) {
      throw new EmployeeError(
        409,
        "The selected temporary head needs an active Staff account",
      )
    }
    const candidateAccount = await tx.user.findUnique({
      where: { id: candidateUserId },
      select: {
        id: true,
        role: true,
        isActive: true,
        headOf: { select: { id: true } },
        leadOfTeam: { select: { id: true } },
      },
    })
    if (
      !candidateAccount ||
      candidateAccount.role !== Role.STAFF ||
      !candidateAccount.isActive ||
      candidateAccount.headOf ||
      candidateAccount.leadOfTeam
    ) {
      throw new EmployeeError(
        409,
        "The selected temporary head is no longer eligible; refresh and choose again",
      )
    }

    const canRestoreOriginal =
      nextDepartmentId === currentDepartment.id && nextUserId === oldUserId
    const originalHeadId =
      currentDepartment.temporaryHeadOriginalId ??
      (canRestoreOriginal ? oldUserId : null)

    await tx.department.update({
      where: { id: currentDepartment.id },
      data: {
        headId: candidateAccount.id,
        temporaryHeadOriginalId: originalHeadId,
        temporaryHeadAssignedId: originalHeadId ? candidateAccount.id : null,
      },
    })
    await tx.user.update({
      where: { id: candidateAccount.id },
      data: { departmentId: currentDepartment.id, teamId: null },
    })
    await tx.employee.update({
      where: { id: replacementHead.id },
      data: { teamId: null },
    })
  }

  if (returningDepartment && oldUserId) {
    const restoreOriginal = Boolean(
      nextDepartmentId === returningDepartment.id &&
      nextUserId === oldUserId &&
      returningDepartment.headId ===
        returningDepartment.temporaryHeadAssignedId,
    )
    await tx.department.update({
      where: { id: returningDepartment.id },
      data: {
        ...(restoreOriginal ? { headId: oldUserId } : {}),
        temporaryHeadOriginalId: null,
        temporaryHeadAssignedId: null,
      },
    })
  }

  if (oldUserId) {
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

  if (nextUserId) {
    await tx.user.update({
      where: { id: nextUserId },
      data: {
        departmentId: nextDepartmentId,
        teamId: nextTeamId,
        position: nextPosition,
        fullName: input.fullName !== undefined ? employee.fullName : undefined,
        email:
          input.email !== undefined ? (employee.email ?? undefined) : undefined,
        contactNumber:
          input.contactNumber !== undefined
            ? employee.contactNumber
            : undefined,
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
