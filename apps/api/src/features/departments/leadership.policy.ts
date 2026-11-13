/**
 * Who may lead a department or team, and who may hold a "Department Head"
 * job title. The single source for these rules across departments, teams,
 * employees (temporary heads) and account management.
 *
 * A leadership candidate (department head, team lead or temporary head) is:
 * an active STAFF login that is not in Trash, linked to an employee record
 * with ACTIVE status, and not assigned to a different department (by account,
 * employee record or team). A team lead cannot also be a department head.
 */
import {
  EmployeeStatus,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js"
import { lockRows } from "../../shared/db/locks.js"
import { activeStaff } from "../../shared/query/accounts.js"
import { HttpError } from "../../shared/http-error.js"

export type LeadershipKind = "head" | "lead" | "tempHead"

const departmentHeadTitles = new Set(["dept head", "department head"])

/** "Department Head"-like job titles, ignoring case and extra whitespace. */
export function isDepartmentHeadTitle(
  title: string | null | undefined,
): boolean {
  if (!title) return false
  return departmentHeadTitles.has(
    title.trim().replace(/\s+/g, " ").toLowerCase(),
  )
}

export const DEPARTMENT_HEAD_TITLE_MESSAGE =
  "Only the assigned Department Head can have the title 'Department Head'"

/**
 * Rejects a "Department Head"-like `title` unless `userId` heads
 * `departmentId`. An on-leave original head (tracked as
 * `temporaryHeadOriginalId`) keeps an unchanged title until they return.
 */
export async function assertDepartmentHeadTitle(
  tx: Prisma.TransactionClient,
  {
    title,
    userId,
    departmentId,
    currentTitle,
  }: {
    title: string | null | undefined
    userId: string | null | undefined
    departmentId: string | null | undefined
    currentTitle?: string | null
  },
) {
  if (!isDepartmentHeadTitle(title)) return
  if (userId && departmentId) {
    const department = await tx.department.findUnique({
      where: { id: departmentId },
      select: { headId: true, temporaryHeadOriginalId: true },
    })
    if (department?.headId === userId) return
    if (
      department?.temporaryHeadOriginalId === userId &&
      currentTitle === title
    )
      return
  }
  throw new HttpError(400, DEPARTMENT_HEAD_TITLE_MESSAGE)
}

/**
 * Prisma filter for accounts eligible to lead `departmentId` (null: a new
 * department, so only unassigned staff; undefined: any department).
 * Mirrors `assertLeadershipCandidate`, without the team-lead/head conflicts.
 */
export function leadershipCandidateWhere(
  departmentId?: string | null,
): Prisma.UserWhereInput {
  const sameDepartment =
    departmentId === undefined
      ? {}
      : departmentId === null
        ? { departmentId: null, teamId: null }
        : {
            OR: [{ departmentId: null }, { departmentId }],
            AND: [
              { OR: [{ teamId: null }, { team: { is: { departmentId } } }] },
            ],
          }
  const employeeDepartment =
    departmentId === undefined
      ? {}
      : departmentId === null
        ? { departmentId: null }
        : { OR: [{ departmentId: null }, { departmentId }] }
  return {
    ...activeStaff,
    ...sameDepartment,
    employee: { is: { status: EmployeeStatus.ACTIVE, ...employeeDepartment } },
  }
}

type Messages = {
  status: number
  missing: string
  account: string
  employee: string
  department: string
}

const messages: Record<LeadershipKind, Messages> = {
  head: {
    status: 400,
    missing: "Selected department head user not found",
    account: "Only active staff accounts can be Department Heads.",
    employee: "Only employees with active status can be Department Heads.",
    department:
      "Department Heads must be unassigned or already belong to this department.",
  },
  lead: {
    status: 400,
    missing: "Only active staff accounts can be Team Leads.",
    account: "Only active staff accounts can be Team Leads.",
    employee: "Only employees with active status can be Team Leads.",
    department: "Team Leads must belong to the department that owns the team.",
  },
  // The temporary head was picked from a list; any change since is a race.
  tempHead: {
    status: 409,
    missing:
      "The selected temporary head is no longer eligible; refresh and choose again",
    account:
      "The selected temporary head is no longer eligible; refresh and choose again",
    employee:
      "The selected temporary head is no longer eligible; refresh and choose again",
    department:
      "The selected temporary head is no longer eligible; refresh and choose again",
  },
}

/**
 * Locks `userId` and verifies it may take the `kind` leadership role in
 * `departmentId` (null when the department is being created). Throws an
 * `HttpError` describing the first failed rule.
 *
 * - head: also rejects a current Team Lead (409) or another department's head.
 * - lead: also rejects a department head or the lead of another team
 *   (`currentTeamId` is the team being edited; `conflictStatus` its status).
 * - tempHead: also rejects anyone already heading or leading.
 */
export async function assertLeadershipCandidate(
  tx: Prisma.TransactionClient,
  userId: string,
  {
    kind,
    departmentId,
    currentTeamId,
    conflictStatus = 409,
  }: {
    kind: LeadershipKind
    departmentId: string | null
    currentTeamId?: string
    conflictStatus?: number
  },
) {
  const text = messages[kind]
  await lockRows(tx, "User", userId)
  const candidate = await tx.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      accountDeletedAt: true,
      departmentId: true,
      employee: { select: { departmentId: true, status: true } },
      team: { select: { departmentId: true } },
      headOf: { select: { id: true } },
      leadOfTeam: { select: { id: true } },
    },
  })
  if (!candidate) throw new HttpError(text.status, text.missing)
  if (
    candidate.role !== Role.STAFF ||
    !candidate.isActive ||
    candidate.accountDeletedAt
  )
    throw new HttpError(text.status, text.account)
  if (candidate.employee?.status !== EmployeeStatus.ACTIVE)
    throw new HttpError(text.status, text.employee)

  const assignedDepartmentIds = [
    candidate.departmentId,
    candidate.employee.departmentId,
    candidate.team?.departmentId,
  ].filter((id): id is string => id != null)
  if (assignedDepartmentIds.some((id) => id !== departmentId))
    throw new HttpError(text.status, text.department)

  if (kind === "head") {
    if (candidate.leadOfTeam)
      throw new HttpError(
        409,
        "Reassign this Team Lead before making them a Department Head.",
      )
    if (candidate.headOf && candidate.headOf.id !== departmentId)
      throw new HttpError(409, "This staff member already heads a department.")
    return
  }

  if (kind === "lead") {
    const leadsOtherTeam =
      candidate.leadOfTeam && candidate.leadOfTeam.id !== currentTeamId
    if (candidate.headOf || leadsOtherTeam)
      throw new HttpError(
        conflictStatus,
        "Reassign the current lead role before assigning this Team Lead.",
      )
    return
  }

  if (candidate.headOf || candidate.leadOfTeam)
    throw new HttpError(text.status, text.account)
}
