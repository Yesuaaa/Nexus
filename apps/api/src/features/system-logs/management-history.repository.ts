import {
  Prisma,
  AccountManagementAction,
  WorkforceManagementAction,
} from "../../generated/prisma/client.js"
import { readTransaction } from "../../lib/database-read.js"
import {
  sourceModule,
  sources,
  type ManagementSource,
} from "./management-event.js"
import type { ManagementFilters, Position } from "./management-query.js"

export const SCAN_CAP = 500
const commonSelect = {
  id: true,
  actorAccountId: true,
  actorRoleAtTime: true,
  operationId: true,
  action: true,
  origin: true,
  changedFields: true,
  changes: true,
  createdAt: true,
} as const
export const accountHistorySelect = {
  ...commonSelect,
  subjectAccountId: true,
} satisfies Prisma.AccountManagementChangeSelect
export const workforceHistorySelect = {
  ...commonSelect,
  subjectType: true,
  subjectId: true,
} satisfies Prisma.WorkforceManagementChangeSelect
type AccountRow = Prisma.AccountManagementChangeGetPayload<{
  select: typeof accountHistorySelect
}>
type WorkforceRow = Prisma.WorkforceManagementChangeGetPayload<{
  select: typeof workforceHistorySelect
}>
const columns = Prisma.sql`id, "actorAccountId", "actorRoleAtTime", "operationId", action, origin, "changedFields", changes, "createdAt"`

export function commonWhere(
  source: ManagementSource,
  f: ManagementFilters,
  snapshot: string,
  after: Position | null,
) {
  const until = f.to < snapshot ? f.to : snapshot
  const continuation = !after
    ? Prisma.empty
    : Prisma.sql`AND ("createdAt" < ${new Date(after.time)} OR ("createdAt" = ${new Date(after.time)} AND ${source > after.source ? Prisma.sql`TRUE` : source === after.source ? Prisma.sql`id COLLATE "C" < ${after.id} COLLATE "C"` : Prisma.sql`FALSE`}))`
  return Prisma.sql`"createdAt" >= ${new Date(f.from)} AND "createdAt" <= ${new Date(until)} ${continuation}
    ${f.actorId ? (source === "audit.attendance" || source === "audit.workflow" ? Prisma.sql`AND "actorId" = ${f.actorId}` : Prisma.sql`AND "actorAccountId" = ${f.actorId}`) : Prisma.empty}
    ${f.operationId ? Prisma.sql`AND "operationId" = ${f.operationId}::uuid` : Prisma.empty}`
}
/** Explicit projections and parameterized SQL through shared Prisma reads. C collation
 * keeps opaque ID ordering identical to the cross-source merge on every deployment. */
export function readAccountHistory(
  f: ManagementFilters,
  snapshot: string,
  after: Position | null,
  eventId?: string,
) {
  const origins = [
    "ACCOUNT_MANAGEMENT",
    "CLIENT_MANAGEMENT",
    "EMPLOYEE_MANAGEMENT",
  ] as const
  const action = f.action ?? f.eventName?.split(".")[1].toUpperCase()
  if (
    (f.subjectType && f.subjectType !== "account") ||
    (f.eventName && !f.eventName.startsWith("account.")) ||
    (action &&
      !Object.values(AccountManagementAction).includes(
        action as AccountManagementAction,
      ))
  )
    return Promise.resolve([])
  const selectedOrigins = origins.filter(
    (o) => !f.moduleId || sourceModule(sources[0], o) === f.moduleId,
  )
  if (!selectedOrigins.length) return Promise.resolve([])
  return readTransaction((tx) =>
    tx.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT ${columns}, "subjectAccountId" FROM "AccountManagementChange"
    WHERE ${commonWhere(sources[0], f, snapshot, after)}
    AND origin::text IN (${Prisma.join(selectedOrigins)})
    ${eventId ? Prisma.sql`AND id = ${eventId}` : Prisma.empty}
    ${f.subjectId ? Prisma.sql`AND "subjectAccountId" = ${f.subjectId}` : Prisma.empty}
    ${action ? Prisma.sql`AND action::text = ${action}` : Prisma.empty}
    ORDER BY "createdAt" DESC, id COLLATE "C" DESC LIMIT ${eventId ? 1 : SCAN_CAP + 1}`),
  )
}
export function readWorkforceHistory(
  f: ManagementFilters,
  snapshot: string,
  after: Position | null,
  eventId?: string,
) {
  const origins = [
    "ACCOUNT_MANAGEMENT",
    "EMPLOYEE_MANAGEMENT",
    "DEPARTMENT_MANAGEMENT",
    "TEAM_MANAGEMENT",
  ] as const
  const subject = f.subjectType ?? f.eventName?.split(".")[0]
  const action = f.action ?? f.eventName?.split(".")[1].toUpperCase()
  if (
    subject === "account" ||
    (action &&
      !Object.values(WorkforceManagementAction).includes(
        action as WorkforceManagementAction,
      ))
  )
    return Promise.resolve([])
  const selectedOrigins = origins.filter(
    (o) => !f.moduleId || sourceModule(sources[1], o) === f.moduleId,
  )
  if (!selectedOrigins.length) return Promise.resolve([])
  return readTransaction((tx) =>
    tx.$queryRaw<WorkforceRow[]>(Prisma.sql`
    SELECT ${columns}, "subjectType", "subjectId" FROM "WorkforceManagementChange"
    WHERE ${commonWhere(sources[1], f, snapshot, after)}
    AND origin::text IN (${Prisma.join(selectedOrigins)})
    ${eventId ? Prisma.sql`AND id = ${eventId}` : Prisma.empty}
    ${subject ? Prisma.sql`AND "subjectType"::text = ${subject.toUpperCase()}` : Prisma.empty}
    ${f.subjectId ? Prisma.sql`AND "subjectId" = ${f.subjectId}` : Prisma.empty}
    ${action ? Prisma.sql`AND action::text = ${action}` : Prisma.empty}
    ORDER BY "createdAt" DESC, id COLLATE "C" DESC LIMIT ${eventId ? 1 : SCAN_CAP + 1}`),
  )
}
