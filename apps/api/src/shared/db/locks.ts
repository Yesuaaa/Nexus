/**
 * Row locks for interactive Prisma transactions.
 *
 * Only whitelisted tables (and, for `Employee`, the `userId` column) can be
 * locked, so no free-form SQL identifier ever reaches a query. Values are
 * always bound parameters.
 *
 * Lock order
 * ----------
 * A transaction that locks rows in several of these tables must take them in
 * this order, which every existing transaction follows:
 *
 *   ServiceRequest → Department → Project → ProjectMilestone
 *
 * (A ProjectWorkspaceGroup is locked before its Projects.) Within one table,
 * `lockRows` locks ids one statement at a time in sorted order, so two
 * transactions locking overlapping id sets cannot deadlock on each other.
 *
 * Account rows keep the order of their existing call sites: employee writes
 * lock Department → Employee → User, and `syncEmployeeForUser` locks the
 * Employee row (by `userId`) before falling back to the User row.
 */
import { Prisma } from "../../generated/prisma/client.js"

export type LockableTable =
  | "ServiceRequest"
  | "Department"
  | "Project"
  | "ProjectMilestone"
  | "ProjectWorkspaceGroup"
  | "RequestConversation"
  | "PricingTemplate"
  | "User"
  | "Employee"

/** `update` = `FOR UPDATE` (writers); `share` = `FOR SHARE` (readers that must see a stable row). */
export type LockMode = "update" | "share"

/** Lockable columns per table; only `Employee` may be locked by `userId`. */
type LockColumn<T extends LockableTable> = T extends "Employee"
  ? "id" | "userId"
  : "id"

type LockIds =
  string | null | undefined | readonly (string | null | undefined)[]

const lockableTables: ReadonlySet<string> = new Set<LockableTable>([
  "ServiceRequest",
  "Department",
  "Project",
  "ProjectMilestone",
  "ProjectWorkspaceGroup",
  "RequestConversation",
  "PricingTemplate",
  "User",
  "Employee",
])

const lockClause: Record<LockMode, Prisma.Sql> = {
  update: Prisma.raw("FOR UPDATE"),
  share: Prisma.raw("FOR SHARE"),
}

function sortedIds(ids: LockIds): string[] {
  const list = (Array.isArray(ids) ? ids : [ids]) as (
    string | null | undefined
  )[]
  return [...new Set(list.filter((id): id is string => Boolean(id)))].sort()
}

function lockStatement<T extends LockableTable>(
  table: T,
  column: LockColumn<T>,
  value: string,
  mode: LockMode,
) {
  // `table` and `column` are compile-time unions; the runtime check keeps a
  // cast or `any` from ever smuggling another identifier into the SQL.
  if (
    !lockableTables.has(table) ||
    (column !== "id" && !(table === "Employee" && column === "userId"))
  )
    throw new Error(`Refusing to lock ${table}.${column}`)
  return Prisma.sql`SELECT "id" FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} = ${value} ${lockClause[mode]}`
}

/**
 * Locks the rows with `ids` (nullish ids are skipped) until the transaction
 * ends, one sorted id at a time.
 */
export async function lockRows(
  tx: Prisma.TransactionClient,
  table: LockableTable,
  ids: LockIds,
  mode: LockMode = "update",
): Promise<void> {
  for (const id of sortedIds(ids))
    await tx.$queryRaw(lockStatement(table, "id", id, mode))
}

/**
 * Like `lockRows`, but returns the ids of the rows that were locked (missing
 * rows are simply absent), and can match `Employee` rows by `userId`.
 */
export async function lockRowsReturning<T extends LockableTable>(
  tx: Prisma.TransactionClient,
  table: T,
  values: LockIds,
  mode: LockMode = "update",
  column: LockColumn<T> = "id" as LockColumn<T>,
): Promise<{ id: string }[]> {
  const locked: { id: string }[] = []
  for (const value of sortedIds(values))
    locked.push(
      ...(await tx.$queryRaw<{ id: string }[]>(
        lockStatement(table, column, value, mode),
      )),
    )
  return locked
}

/**
 * Serializes work on one service request: locks the request (`FOR UPDATE` by
 * default) and then shares its accepted department, so a concurrent head
 * handoff cannot authorize an action using the former head. Returns the
 * request's accepted department id (null when unaccepted or missing).
 */
export async function lockServiceRequest(
  tx: Prisma.TransactionClient,
  requestId: string | null | undefined,
  mode: LockMode = "update",
): Promise<string | null> {
  if (!requestId) return null
  await lockRows(tx, "ServiceRequest", requestId, mode)
  const request = await tx.serviceRequest.findUnique({
    where: { id: requestId },
    select: { acceptedDepartmentId: true },
  })
  const departmentId = request?.acceptedDepartmentId ?? null
  await lockRows(tx, "Department", departmentId, "share")
  return departmentId
}
