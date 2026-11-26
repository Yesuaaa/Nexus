// Explicit runner only. Requires a task-owned, fresh, migrated local cluster.
import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { realpath } from "node:fs/promises"
import { test, type TestContext } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { disconnectPrisma, getPrisma } from "../../../src/lib/db.js"
import {
  closeServer,
  listen,
  migrationNames,
} from "../../support/pglite-app.js"
import {
  day,
  end,
  note,
  now,
  reconcilePath,
  recordsFixture,
} from "../../support/pg015-records.js"

async function database(t: TestContext) {
  const urlValue = process.env.PG015_POSTGRES_URL
  const dataDirectory = process.env.PG015_POSTGRES_DATA_DIR
  assert(urlValue && dataDirectory, "VERIFIED DISPOSABLE POSTGRESQL REQUIRED")
  const url = new URL(urlValue)
  assert.equal(url.protocol, "postgresql:")
  assert.equal(url.hostname, "127.0.0.1")
  assert.ok(url.port)
  assert.equal(url.pathname, "/nexus_pg015_reconciliation")
  assert.equal(url.username, "pg015_owner")
  url.search = "?sslmode=disable"
  const control = new pg.Client({ connectionString: url.toString() })
  const observer = new pg.Client({ connectionString: url.toString() })
  await control.connect()
  t.after(() => control.end())
  await observer.connect()
  t.after(() => observer.end())
  const identity = (
    await observer.query<{
      database: string
      owner: string
      host: string
      port: number
      pid: number
      data_directory: string
      isolation: string
      version: string
    }>(`
    SELECT current_database() AS database, current_user AS owner,
      host(inet_server_addr()) AS host, inet_server_port() AS port,
      pg_backend_pid() AS pid, current_setting('data_directory') AS data_directory,
      current_setting('default_transaction_isolation') AS isolation, current_setting('server_version') AS version
  `)
  ).rows[0]
  assert.equal(identity.database, "nexus_pg015_reconciliation")
  assert.equal(identity.owner, "pg015_owner")
  assert.equal(identity.host, "127.0.0.1")
  assert.equal(identity.port, Number(url.port))
  assert.equal(identity.isolation, "read committed")
  assert.equal(
    await realpath(identity.data_directory),
    await realpath(dataDirectory),
  )
  const migrated = await observer.query<{ migration_name: string }>(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  )
  assert.deepEqual(
    migrated.rows.map(({ migration_name }) => migration_name),
    await migrationNames(),
  )
  const seed = (
    await observer.query<Record<string, number>>(`
    SELECT (SELECT count(*)::int FROM "User") AS accounts,
      (SELECT count(*)::int FROM "Employee") AS employees,
      (SELECT count(*)::int FROM "Department") AS departments,
      (SELECT count(*)::int FROM "AttendanceWorkSession") AS sessions,
      (SELECT count(*)::int FROM "AttendanceBreak") AS breaks,
      (SELECT count(*)::int FROM "AttendanceWorkday") AS workdays,
      (SELECT count(*)::int FROM "AttendanceAudit") AS audits,
      (SELECT count(*)::int FROM "AttendanceAdjustment") AS adjustments,
      (SELECT count(*)::int FROM "WorkflowNotification") AS notifications
  `)
  ).rows[0]
  assert.ok(
    Object.values(seed).every((count) => count === 0),
    "Database must have zero domain rows before seeding",
  )
  t.diagnostic(
    JSON.stringify({
      database: identity.database,
      host: identity.host,
      port: identity.port,
      owner: identity.owner,
      version: identity.version,
      isolation: identity.isolation,
      migrations: migrated.rowCount,
      seed,
    }),
  )
  const appName = "pg015-" + randomUUID()
  const blocker = (
    await control.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
  ).rows[0].pid
  assert.notEqual(blocker, identity.pid)
  url.searchParams.set("application_name", appName)
  process.env.DATABASE_URL = url.toString()
  delete process.env.DIRECT_URL
  process.env.DATABASE_POOL_MAX = "6"
  process.env.JWT_SECRET = randomBytes(32).toString("base64url")
  const prisma = getPrisma()!
  const { server, origin } = await listen(
    createApp({ attendanceClock: () => now }),
  )
  t.after(async () => {
    await closeServer(server)
    await disconnectPrisma()
  })

  async function waitForEmployeeLocks(count: number) {
    const deadline = Date.now() + 4000
    while (Date.now() < deadline) {
      const { rows } = await observer.query<{
        pid: number
        blockers: number[]
      }>(
        `
        SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock'
          AND query LIKE '%"Employee"%' AND query LIKE '%FOR UPDATE%'
        ORDER BY pid
      `,
        [appName],
      )
      if (
        rows.length === count &&
        rows.some((row) => row.blockers.includes(blocker))
      ) {
        const participating = new Set([blocker, ...rows.map(({ pid }) => pid)])
        assert.ok(
          rows.every((row) =>
            row.blockers.some((pid) => participating.has(pid)),
          ),
        )
        t.diagnostic(JSON.stringify({ controlPid: blocker, waiters: rows }))
        return
      }
      await delay(25)
    }
    assert.fail(
      "Expected " + count + " independent API Employee lock waiter(s)",
    )
  }

  async function deadlocks() {
    await observer.query("SELECT pg_stat_clear_snapshot()")
    return (
      await observer.query<{ deadlocks: number }>(
        "SELECT deadlocks::int FROM pg_stat_database WHERE datname = current_database()",
      )
    ).rows[0].deadlocks
  }
  return {
    control,
    prisma,
    waitForEmployeeLocks,
    deadlocks,
    ...recordsFixture(prisma, origin + "/api"),
  }
}

test(
  "[PG-015-F001-A019-T001] overlapping reconciliation writers close the shift exactly once",
  { timeout: 30000 },
  async (t) => {
    const { control, prisma, setup, read, waitForEmployeeLocks, deadlocks } =
      await database(t)
    const f = await setup()
    const shift = await f.suspended()
    const pause = await prisma.attendanceBreak.create({
      data: {
        sessionId: shift.id,
        startedAt: new Date(day + "T10:00:00Z"),
        isPaid: false,
      },
    })
    const leave = await f.leave(day)
    const path = reconcilePath(f.subject.employee.id, shift.id)
    const before = await deadlocks()
    await control.query("BEGIN")
    const pending: Promise<Response>[] = []
    try {
      await control.query(
        'SELECT id FROM "Employee" WHERE id = $1 FOR UPDATE',
        [f.subject.employee.id],
      )
      for (const { token } of [f.admin, f.supervisor])
        pending.push(read(path, token, { endedAt: end, note }))
      await waitForEmployeeLocks(2)
    } finally {
      await control.query("ROLLBACK")
      await Promise.allSettled(pending)
    }
    const responses = await Promise.all(pending)
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409])
    const winner = responses[0].status === 200 ? f.admin : f.supervisor
    const closed = await prisma.attendanceWorkSession.findUniqueOrThrow({
      where: { id: shift.id },
    })
    assert.deepEqual(closed.endedAt, new Date(end))
    assert.deepEqual(closed.suspendedAt, shift.suspendedAt)
    assert.deepEqual(
      (
        await prisma.attendanceBreak.findUniqueOrThrow({
          where: { id: pause.id },
        })
      ).endedAt,
      closed.endedAt,
    )
    const audit = await prisma.attendanceAudit.findMany({
      where: { entityId: { in: [shift.id, pause.id] }, action: "UPDATE" },
    })
    assert.equal(audit.length, 2)
    assert.ok(
      audit.every(
        (entry) =>
          entry.actorId === winner.user.id && entry.reason.includes(note),
      ),
    )
    assert.ok(audit[0].operationId)
    assert.equal(new Set(audit.map(({ operationId }) => operationId)).size, 1)
    const notices = await prisma.workflowNotification.findMany({
      where: { leaveRequestId: leave.id, type: "LEAVE_ATTENDANCE_CONFLICT" },
    })
    assert.deepEqual(
      notices.map(({ userId }) => userId).sort(),
      [f.admin.user.id, f.supervisor.user.id].sort(),
    )
    assert.equal(await deadlocks(), before)
    t.diagnostic(
      "HTTP 200/409; one grouped session/break close and two distinct HR notices; no new deadlocks",
    )
  },
)

test(
  "[PG-015-F001-A019-T002] placement commit rejects a waiting reconciliation without write effects",
  { timeout: 30000 },
  async (t) => {
    const { control, prisma, setup, read, waitForEmployeeLocks, deadlocks } =
      await database(t)
    const f = await setup()
    const shift = await f.suspended()
    const pause = await prisma.attendanceBreak.create({
      data: {
        sessionId: shift.id,
        startedAt: new Date(day + "T10:00:00Z"),
        isPaid: false,
      },
    })
    const path = reconcilePath(f.subject.employee.id, shift.id)
    const before = await deadlocks()
    const auditCount = await prisma.attendanceAudit.count({
      where: { entityId: { in: [shift.id, pause.id] } },
    })
    await control.query("BEGIN")
    let pending: Promise<Response> | undefined
    try {
      for (const department of [f.department.id, f.outside.id].sort()) {
        await control.query(
          'SELECT id FROM "Department" WHERE id = $1 FOR SHARE',
          [department],
        )
      }
      await control.query(
        "SELECT set_config('app.attendance_actor_id',$1,true), set_config('app.attendance_reason','PG-015 placement fixture',true), set_config('app.attendance_operation_id',$2,true)",
        [f.admin.user.id, randomUUID()],
      )
      await control.query(
        'UPDATE "Employee" SET "departmentId" = $1 WHERE id = $2',
        [f.outside.id, f.subject.employee.id],
      )
      pending = read(path, f.admin.token, { endedAt: end, note })
      await waitForEmployeeLocks(1)
      await control.query("COMMIT")
    } finally {
      await control.query("ROLLBACK")
      await Promise.allSettled(pending ? [pending] : [])
    }
    const rejected = await pending
    assert.equal(rejected.status, 409)
    assert.deepEqual(await rejected.json(), {
      error: "Employee placement changed; refresh and try again",
    })
    assert.equal(
      (
        await prisma.employee.findUniqueOrThrow({
          where: { id: f.subject.employee.id },
        })
      ).departmentId,
      f.outside.id,
    )
    assert.deepEqual(
      await prisma.attendanceWorkSession.findUnique({
        where: { id: shift.id },
      }),
      shift,
    )
    assert.deepEqual(
      await prisma.attendanceBreak.findUnique({ where: { id: pause.id } }),
      pause,
    )
    assert.equal(
      await prisma.attendanceAudit.count({
        where: { entityId: { in: [shift.id, pause.id] } },
      }),
      auditCount,
    )
    assert.equal(await prisma.workflowNotification.count(), 0)
    assert.equal(await prisma.attendanceAdjustment.count(), 0)
    assert.equal(
      (await read(path, f.admin.token, { endedAt: end, note })).status,
      200,
    )
    assert.deepEqual(
      (
        await prisma.attendanceWorkSession.findUniqueOrThrow({
          where: { id: shift.id },
        })
      ).endedAt,
      new Date(end),
    )
    assert.equal(await deadlocks(), before)
    t.diagnostic(
      "Observed transfer while Employee lock waited; HTTP 409 then HTTP 200 on fresh read of placement",
    )
  },
)
