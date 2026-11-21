import { randomUUID } from "node:crypto"
import {
  EmployeeStatus,
  EmploymentType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js"
import {
  assertDepartmentHeadTitle,
  assertLeadershipCandidate,
  isDepartmentHeadTitle,
  leadershipCandidateWhere,
} from "../departments/leadership.policy.js"
import { lockRows, lockRowsReturning } from "../../shared/db/locks.js"
import { getPrisma } from "../../lib/db.js"
import {
  assertNotSelf,
  deleteAccountPermanently,
  moveAccountToTrash,
  setAccountActive,
} from "../users/account-lifecycle.js"
import { directoryLogin, employeeInclude } from "./employees.repository.js"
import type { EmployeeInput } from "./employees.schema.js"
import { HttpError as EmployeeError } from "../../shared/http-error.js"
import type { AuthContext } from "../auth/auth.middleware.js"
import {
  createManagementOperation,
  type ManagementOperation,
} from "../../shared/management-history.js"
import { writeWorkforceManagementChange } from "./workforce-management-history.js"
import {
  employeeAssignmentSelect,
  userUpdateSelect,
  recordDepartmentLeadership,
  recordEmployeeAssignments,
  recordEmployeeUpdate,
  recordUserSynchronization,
} from "./employee-update-history.js"
import { writeAccountManagementChange } from "../users/account-management-history.js"
import {
  readAccountDeletionWorkforce,
  writeAccountDeletionWorkforce,
} from "../users/account-workforce-history.js"

export { employeeInclude }

/** Feature-named alias of the shared `HttpError`. */
export { EmployeeError }

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
          ...leadershipCandidateWhere(departmentId),
          headOf: null,
          leadOfTeam: null,
        },
      },
    },
    select: departmentHeadCandidateSelect,
  })
  return candidates.sort(compareSeniority)
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
  operation?: ManagementOperation,
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
      // Sorted, one at a time (lockRows), like every Department lock.
      await lockRows(tx, "Department", [...departmentIds])
    }

    await lockRows(tx, "Employee", id)
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
    await lockRows(tx, "Employee", replacementHeadCandidate.id)
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
  const restoreOriginal = Boolean(
    returningDepartment &&
    oldUserId &&
    nextDepartmentId === returningDepartment.id &&
    nextUserId === oldUserId &&
    returningDepartment.headId === returningDepartment.temporaryHeadAssignedId,
  )

  await assertDepartmentHeadTitle(tx, {
    title: nextPosition,
    userId: nextUserId,
    departmentId: nextDepartmentId,
    currentTitle: existing?.position,
  })

  const linkedUserIds = [
    ...new Set(
      [oldUserId, nextUserId, replacementHeadCandidate?.userId].filter(
        (userId): userId is string => Boolean(userId),
      ),
    ),
  ].sort()
  await lockRows(tx, "User", linkedUserIds)

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
      if (department?.headId === nextUserId || restoreOriginal) {
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
    await assertLeadershipCandidate(tx, candidateUserId, {
      kind: "tempHead",
      departmentId: currentDepartment.id,
    })

    const canRestoreOriginal =
      nextDepartmentId === currentDepartment.id && nextUserId === oldUserId
    const originalHeadId =
      currentDepartment.temporaryHeadOriginalId ??
      (canRestoreOriginal ? oldUserId : null)

    const afterDepartment = await tx.department.update({
      where: { id: currentDepartment.id },
      data: {
        headId: candidateUserId,
        temporaryHeadOriginalId: originalHeadId,
        temporaryHeadAssignedId: originalHeadId ? candidateUserId : null,
      },
    })
    if (operation)
      await recordDepartmentLeadership(
        tx,
        operation,
        currentDepartment,
        afterDepartment,
      )
    const candidateBefore = operation
      ? await tx.user.findUniqueOrThrow({
          where: { id: candidateUserId },
          select: userUpdateSelect,
        })
      : null
    const replacementBefore = operation
      ? await tx.employee.findUniqueOrThrow({
          where: { id: replacementHead.id },
          select: employeeAssignmentSelect,
        })
      : null
    await tx.user.update({
      where: { id: candidateUserId },
      data: { departmentId: currentDepartment.id, teamId: null },
    })
    const replacementAfter = await tx.employee.update({
      where: { id: replacementHead.id },
      data: { teamId: null },
    })
    if (operation && replacementBefore && candidateBefore) {
      await recordEmployeeAssignments(
        tx,
        operation,
        replacementBefore,
        replacementAfter,
      )
      await recordUserSynchronization(
        tx,
        operation,
        candidateBefore,
        await tx.user.findUniqueOrThrow({
          where: { id: candidateUserId },
          select: userUpdateSelect,
        }),
      )
    }
  }

  if (statusChanged && input.status !== EmployeeStatus.ACTIVE && oldUserId) {
    // Teams work without a lead, so a lead going non-active just steps down.
    if (operation) {
      // Returning the rows actually changed avoids a racy pre-read of Team.
      const teams = await tx.team.updateManyAndReturn({
        where: { leadId: oldUserId },
        data: { leadId: null },
        select: { id: true, leadId: true },
      })
      for (const team of teams)
        await writeWorkforceManagementChange(tx, operation, {
          origin: "EMPLOYEE_MANAGEMENT",
          subjectType: "TEAM",
          subjectId: team.id,
          action: "LEAD_CHANGED",
          changedFields: ["leadId"],
          changes: { leadId: { before: oldUserId, after: team.leadId } },
        })
    } else {
      await tx.team.updateMany({
        where: { leadId: oldUserId },
        data: { leadId: null },
      })
    }
  }

  if (returningDepartment && oldUserId) {
    const afterDepartment = await tx.department.update({
      where: { id: returningDepartment.id },
      data: {
        ...(restoreOriginal ? { headId: oldUserId } : {}),
        temporaryHeadOriginalId: null,
        temporaryHeadAssignedId: null,
      },
    })
    if (operation)
      await recordDepartmentLeadership(
        tx,
        operation,
        returningDepartment,
        afterDepartment,
      )
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

  let employee = existing
    ? await tx.employee.update({
        where: { id: existing.id },
        data,
        include: employeeInclude,
      })
    : await tx.employee.create({ data, include: employeeInclude })

  let mirrors: ("fullName" | "email" | "contactNumber" | "position")[] = []
  if (nextUserId) {
    const beforeUser = operation
      ? await tx.user.findUniqueOrThrow({
          where: { id: nextUserId },
          select: userUpdateSelect,
        })
      : null
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
    if (operation && beforeUser)
      mirrors = await recordUserSynchronization(
        tx,
        operation,
        beforeUser,
        await tx.user.findUniqueOrThrow({
          where: { id: nextUserId },
          select: userUpdateSelect,
        }),
      )
  }

  let ownTitleCleared = false
  if (isDepartmentHeadLeaving && oldUserId) {
    const cleared = await clearFormerDepartmentHeadTitle(
      tx,
      oldUserId,
      operation && currentDepartment
        ? { operation, departmentId: currentDepartment.id }
        : undefined,
    )
    ownTitleCleared = cleared
    if (cleared && employee.userId === oldUserId) {
      employee = await tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: employeeInclude,
      })
    }
  }
  if (
    restoreOriginal &&
    returningDepartment?.headId &&
    returningDepartment.headId !== oldUserId
  ) {
    await clearFormerDepartmentHeadTitle(
      tx,
      returningDepartment.headId,
      operation
        ? { operation, departmentId: returningDepartment.id }
        : undefined,
    )
  }
  if (operation && existing) {
    const after = await tx.employee.findUniqueOrThrow({
      where: { id: employee.id },
    })
    await recordEmployeeUpdate(
      tx,
      operation,
      existing,
      after,
      mirrors,
      ownTitleCleared,
    )
  }
  return employee
}

/** Only call after an authorized leadership change, within its transaction.
 * Keep a current or temporarily reserved Head's title; synchronize only the
 * displaced title, without provisioning records or repairing unrelated staff. */
export async function clearFormerDepartmentHeadTitle(
  tx: Prisma.TransactionClient,
  userId: string,
  attribution?: {
    operation: ManagementOperation
    departmentId: string
    origin?: "EMPLOYEE_MANAGEMENT" | "DEPARTMENT_MANAGEMENT"
  },
): Promise<boolean> {
  await lockRowsReturning(tx, "Employee", userId, "update", "userId")
  await lockRows(tx, "User", userId)
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { position: true },
  })
  if (!isDepartmentHeadTitle(user?.position)) return false
  const retained = await tx.department.findFirst({
    where: { OR: [{ headId: userId }, { temporaryHeadOriginalId: userId }] },
    select: { id: true },
  })
  if (retained) return false
  const employeeBefore = attribution
    ? await tx.employee.findUnique({
        where: { userId },
        select: { id: true, position: true },
      })
    : null
  await tx.user.update({ where: { id: userId }, data: { position: null } })
  await tx.employee.updateMany({ where: { userId }, data: { position: null } })
  if (attribution) {
    const afterUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { position: true },
    })
    const afterEmployee = employeeBefore
      ? await tx.employee.findUniqueOrThrow({
          where: { id: employeeBefore.id },
          select: { position: true },
        })
      : null
    // The actual User title changed; mirror it once through its Employee, or
    // through the affected Department when this is a legacy User-only record.
    if (
      user?.position !== afterUser.position ||
      employeeBefore?.position !== afterEmployee?.position
    )
      await writeWorkforceManagementChange(tx, attribution.operation, {
        origin: attribution.origin ?? "EMPLOYEE_MANAGEMENT",
        action: "TITLE_CLEARED",
        subjectType: employeeBefore ? "EMPLOYEE" : "DEPARTMENT",
        subjectId: employeeBefore?.id ?? attribution.departmentId,
        changedFields: ["position"],
        changes: {
          cause: "FORMER_DEPARTMENT_HEAD",
          ...(!employeeBefore ? { affectedAccountId: userId } : {}),
        },
      })
  }
  return true
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
  operation?: ManagementOperation,
) {
  return writeEmployee(tx, id, data, operation)
}

export async function syncEmployeeForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude
}> | null> {
  const lockedEmployee = await lockRowsReturning(
    tx,
    "Employee",
    userId,
    "update",
    "userId",
  )
  if (lockedEmployee.length === 0) await lockRows(tx, "User", userId)
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

const ADMIN_LOGIN_MESSAGE =
  "Admin accounts must be managed from Account Management"

/** Enables or disables the STAFF login linked to an employee directory entry. */
export async function setEmployeeLoginStatus(
  auth: AuthContext,
  employeeId: string,
  isActive: boolean,
) {
  const operation = createManagementOperation(auth)
  await getPrisma()!.$transaction(
    async (tx) => {
      const employee = await directoryLogin(tx, employeeId)
      if (!employee) throw new EmployeeError(404, "Employee not found")
      if (!employee.user || employee.user.accountDeletedAt) {
        throw new EmployeeError(409, "Employee has no login account")
      }
      assertNotSelf(
        operation.actorAccountId,
        employee.user.id,
        "You cannot change your own login status",
      )
      if (employee.user.role !== Role.STAFF) {
        throw new EmployeeError(403, ADMIN_LOGIN_MESSAGE)
      }
      const updated = await setAccountActive(tx, employee.user.id, isActive, {
        role: Role.STAFF,
        isActive: employee.user.isActive,
        accountDeletedAt: null,
      },operation.actorAccountId)
      if (!updated)
        throw new EmployeeError(409, "Employee changed; refresh and retry")
      const after = await tx.user.findUniqueOrThrow({
        where: { id: employee.user.id },
        select: { isActive: true },
      })
      const changed = employee.user.isActive !== after.isActive
      if (changed || !isActive) {
        await writeAccountManagementChange(tx, operation, {
          origin: "EMPLOYEE_MANAGEMENT",
          action: "STATUS_CHANGED",
          subjectAccountId: employee.user.id,
          changedFields: changed ? ["isActive"] : [],
          changes: {
            ...(changed
              ? {
                  isActive: {
                    before: employee.user.isActive,
                    after: after.isActive,
                  },
                }
              : {}),
            sessionsRevoked: !isActive,
          },
        })
      }
    },
    { isolationLevel: "Serializable" },
  )
}

/**
 * Moves an employee's (already deactivated) STAFF login to Archive, or
 * deletes an archived one permanently.
 */
export async function removeEmployeeLogin(
  auth: AuthContext,
  employeeId: string,
  { permanent }: { permanent: boolean },
) {
  const operation = createManagementOperation(auth)
  await getPrisma()!.$transaction(
    async (tx) => {
      const employee = await directoryLogin(tx, employeeId)
      if (!employee) throw new EmployeeError(404, "Employee not found")
      if (!employee.user || (!permanent && employee.user.accountDeletedAt)) {
        throw new EmployeeError(409, "Employee has no login account")
      }
      assertNotSelf(
        operation.actorAccountId,
        employee.user.id,
        "You cannot delete your own login account",
      )
      if (employee.user.role !== Role.STAFF) {
        throw new EmployeeError(403, ADMIN_LOGIN_MESSAGE)
      }
      if (employee.user.isActive)
        throw new EmployeeError(
          409,
          "Deactivate the account before moving it to Archive",
        )
      if (!permanent) {
        const moved = await moveAccountToTrash(tx, employee.user.id, {
          guard: { role: Role.STAFF, isActive: false },
        })
        if (!moved)
          throw new EmployeeError(409, "Employee changed; refresh and retry")
        const after = await tx.user.findUniqueOrThrow({
          where: { id: employee.user.id },
          select: { accountDeletedAt: true },
        })
        await writeAccountManagementChange(tx, operation, {
          origin: "EMPLOYEE_MANAGEMENT",
          action: "ARCHIVED",
          subjectAccountId: employee.user.id,
          changedFields: ["accountDeletedAt"],
          changes: {
            accountDeletedAt: {
              before: null,
              after: after.accountDeletedAt!.toISOString(),
            },
            sessionsRevoked: true,
          },
        })
        return
      }
      if (!employee.user.accountDeletedAt)
        throw new EmployeeError(
          409,
          "Move the account to Archive before deleting it permanently",
        )
      const workforce = await readAccountDeletionWorkforce(tx, employee.user.id)
      const deleted = await deleteAccountPermanently(tx, employee.user.id, {
        guard: {
          role: Role.STAFF,
          isActive: false,
          accountDeletedAt: { not: null },
        },
        linkedMessage:
          "This account has related records and cannot be permanently deleted. Keep it in Archive to preserve its history.",
      })
      if (!deleted)
        throw new EmployeeError(409, "Employee changed; refresh and retry")
      await writeAccountManagementChange(tx, operation, {
        origin: "EMPLOYEE_MANAGEMENT",
        action: "DELETED",
        subjectAccountId: employee.user.id,
        changedFields: [],
        changes: {},
      })
      await writeAccountDeletionWorkforce(
        tx,
        operation,
        workforce,
        "EMPLOYEE_MANAGEMENT",
      )
    },
    { isolationLevel: "Serializable" },
  )
}
