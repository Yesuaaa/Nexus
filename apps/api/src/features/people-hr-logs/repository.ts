import { Prisma, type Role } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { recordTypeLabels, presentPeopleHrOperations } from "./projection.js"

export type HistoryRow = {
  id: string
  operationId: string
  actorAccountId: string
  actorRoleAtTime: Role
  actorName: string | null
  subjectId: string
  subjectType: keyof typeof recordTypeLabels
  subjectName: string | null
  action: string
  origin: string
  changedFields: string[]
  changes: Prisma.JsonValue
  createdAt: Date
}

type LogFilters = {
  page: number
  from?: Date
  to: Date
  source?: string
  event?: string
  actorId?: string
  subjectId?: string
  operationId?: string
  search?: string
}

const pageSize = 25

const history = Prisma.sql`
  SELECT "id", "operationId", "actorAccountId", "actorRoleAtTime",
    "subjectId", "subjectType"::text, "action"::text, "origin"::text,
    "changedFields", "changes", "createdAt"
  FROM "WorkforceManagementChange"
  WHERE "origin" IN ('EMPLOYEE_MANAGEMENT', 'DEPARTMENT_MANAGEMENT', 'TEAM_MANAGEMENT')
  UNION ALL
  SELECT "id", "operationId", "actorAccountId", "actorRoleAtTime",
    "subjectAccountId" AS "subjectId", 'ACCOUNT' AS "subjectType",
    "action"::text, "origin"::text, "changedFields", "changes", "createdAt"
  FROM "AccountManagementChange"
  WHERE "origin" = 'EMPLOYEE_MANAGEMENT'
`

const nameJoins = Prisma.sql`
  LEFT JOIN "User" actor ON actor.id = h."actorAccountId"
  LEFT JOIN "User" account ON h."subjectType" = 'ACCOUNT' AND account.id = h."subjectId"
  LEFT JOIN "Employee" employee ON h."subjectType" = 'EMPLOYEE' AND employee.id = h."subjectId"
  LEFT JOIN "Department" department ON h."subjectType" = 'DEPARTMENT' AND department.id = h."subjectId"
  LEFT JOIN "Team" team ON h."subjectType" = 'TEAM' AND team.id = h."subjectId"
`
const subjectName = Prisma.sql`coalesce(account."fullName", employee."fullName", department.name, team.name)`

export async function listPeopleHrLogs(filters: LogFilters) {
  const where = [Prisma.sql`h."createdAt" <= ${filters.to}`]
  if (filters.from) where.push(Prisma.sql`h."createdAt" >= ${filters.from}`)
  if (filters.source) where.push(Prisma.sql`h."origin" = ${filters.source}`)
  if (filters.event) where.push(Prisma.sql`h."action" = ${filters.event}`)
  if (filters.actorId)
    where.push(Prisma.sql`h."actorAccountId" = ${filters.actorId}`)
  if (filters.subjectId)
    where.push(Prisma.sql`h."subjectId" = ${filters.subjectId}`)
  if (filters.operationId)
    where.push(Prisma.sql`h."operationId" = ${filters.operationId}::uuid`)

  const search = filters.search?.trim()
  if (search)
    where.push(Prisma.sql`
      strpos(lower(concat_ws(' ', h."operationId", h."actorAccountId", actor."fullName",
        h."subjectId", ${subjectName}, replace(h."action", '_', ' '),
        replace(h."origin", '_', ' '), h."subjectType")), lower(${search})) > 0
    `)

  return getPrisma()!.$transaction(
    async (tx) => {
      // Match individual changes, paginate operations, then load all effects of
      // the selected operations so filters never hide part of a committed change.
      const [result] = await tx.$queryRaw<
        {
          total: number
          page: number
          ids: string[]
        }[]
      >`
      WITH matched AS (
        SELECT h."operationId", max(h."createdAt") AS "createdAt"
        FROM (${history}) h
        ${search ? nameJoins : Prisma.empty}
        WHERE ${Prisma.join(where, " AND ")}
        GROUP BY h."operationId"
      ), pagination AS (
        SELECT count(*)::int AS total,
          least(${filters.page}::int, greatest(1, ceil(count(*)::numeric / ${pageSize})))::int AS page
        FROM matched
      )
      SELECT total, page, ARRAY(
        SELECT "operationId" FROM matched
        ORDER BY "createdAt" DESC, "operationId" DESC
        LIMIT ${pageSize} OFFSET (pagination.page - 1) * ${pageSize}
      ) AS ids
      FROM pagination
    `
      const rows = result.ids.length
        ? await tx.$queryRaw<HistoryRow[]>`
          SELECT h.*, left(actor."fullName", 100) AS "actorName",
            left(${subjectName}, 160) AS "subjectName"
          FROM (${history}) h
          ${nameJoins}
          WHERE h."operationId" IN (${Prisma.join(
            result.ids.map((id) => Prisma.sql`${id}::uuid`),
          )})
          ORDER BY h."createdAt" DESC, h.id DESC
        `
        : []
      return {
        events: presentPeopleHrOperations(result.ids, rows),
        total: result.total,
        page: result.page,
        pageSize,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}
