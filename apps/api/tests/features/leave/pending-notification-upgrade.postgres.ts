import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import { promisify } from "node:util"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { LeaveStatus, Role } from "../../../src/generated/prisma/client.js"
import { getPrisma } from "../../../src/lib/db.js"
import {
  closeServer,
  listen,
  migrationNames,
  migrationsDirectory,
  readMigration,
} from "../../support/pglite-app.js"

const boundary = "20261118120000_project_management_logs"
const previous = "20261122130000_attendance_transfer_attribution"
const fix = "20261122140000_leave_pending_notifications_backfill"
const at = "2026-10-01T08:16:27.345Z"
const readAt = "2026-10-25T09:35:27.123Z"
const pendingType = "LEAVE_SUBMITTED"
const inbox = "/request-workflows/notifications"

async function seedLegacy(db: pg.Client) {
  async function insert(
    table: string,
    fields: Record<string, string | number | boolean | null>,
  ) {
    const names = Object.keys(fields)
    await db.query(
      `INSERT INTO "${table}" (${names.map((name) => `"${name}"`).join(", ")})
       VALUES (${names.map((_, index) => `$${index + 1}`).join(", ")})`,
      Object.values(fields),
    )
  }
  async function account(id: string, role: Role = "STAFF") {
    await insert("User", {
      id,
      role,
      email: `${id}@wc-i2-f01.test`,
      fullName: `Synthetic ${id}`,
      passwordHash: "test-only",
      createdAt: at,
      updatedAt: at,
    })
  }
  async function employee(userId: string, departmentId: string | null) {
    await db.query('UPDATE "User" SET "departmentId" = $1 WHERE id = $2', [
      departmentId,
      userId,
    ])
    const id = `employee-${userId}`
    await insert("Employee", {
      id,
      userId,
      departmentId,
      employeeId: `EXP-${userId}`,
      fullName: `Synthetic ${userId}`,
      createdAt: at,
      updatedAt: at,
    })
    return id
  }
  const setHead = (department: string, head: string | null) =>
    db.query('UPDATE "Department" SET "headId" = $1 WHERE id = $2', [
      head,
      department,
    ])
  async function department(id: string, head: string) {
    await insert("Department", { id, name: `Synthetic ${id}`, updatedAt: at })
    await account(head)
    await employee(head, id)
    await setHead(id, head)
  }
  for (const id of ["hr", "other-hr", "disabled-hr", "archived-hr"])
    await account(id, "ADMIN")
  await account("oversight", "SUPERADMIN")
  await db.query(
    `UPDATE "User" SET "isActive" = false WHERE id = 'disabled-hr'`,
  )
  await db.query(
    `UPDATE "User" SET "accountDeletedAt" = $1 WHERE id = 'archived-hr'`,
    [at],
  )

  await department("replacement-dept", "former-head")
  await department("disabled-dept", "disabled-head")
  await department("headless-dept", "vacated-head")
  await department("twice-dept", "first-head")
  await department("self-dept", "self-head")
  await department("linked-dept", "linked-head")
  await department("receiving-dept", "receiving-head")
  await department("archived-dept", "archived-head")
  for (const [head, departmentId] of [
    ["replacement-head", "replacement-dept"],
    ["intermediate-head", "twice-dept"],
    ["final-head", "twice-dept"],
  ]) {
    await account(head)
    await employee(head, departmentId)
  }

  await insert("AttendancePolicy", {
    id: "policy",
    name: "Synthetic policy",
    timeZone: "Asia/Manila",
    createdAt: at,
  })
  await db.query(`
    INSERT INTO "AttendancePolicyDay" ("policyId", weekday, "isWorkingDay", "requiredMinutes")
    SELECT 'policy', weekday, true, 480 FROM generate_series(0, 6) weekday
  `)

  async function leave(
    id: string,
    departmentId: string | null,
    {
      requester,
      linked,
      actions = ["SUBMITTED"],
    }: {
      requester?: string
      linked?: string
      actions?: LeaveStatus[]
    } = {},
  ) {
    const requestedById = requester ?? `requester-${id}`
    if (!requester) await account(requestedById)
    const employeeId = linked
      ? `employee-${linked}`
      : await employee(requestedById, departmentId)
    const assignmentId = `assignment-${id}`
    const workDate = "2026-12-03"
    await insert("AttendancePolicyAssignment", {
      id: assignmentId,
      employeeId,
      policyId: "policy",
      effectiveFrom: "2026-10-01",
      createdAt: at,
    })
    const verified = actions.includes("VERIFIED")
    const requestKey = randomUUID()
    await insert("LeaveRequest", {
      id,
      requestKey,
      employeeId,
      requestedById,
      routeDepartmentId: departmentId,
      type: "ANNUAL",
      reason: "Synthetic legacy leave",
      startDate: workDate,
      endDate: workDate,
      status: actions.at(-1)!,
      version: actions.length,
      verifiedById: verified ? "former-head" : null,
      verifiedAt: verified ? at : null,
      createdAt: at,
      updatedAt: at,
    })
    await insert("LeaveRequestDay", {
      id: `day-${id}`,
      requestId: id,
      employeeId,
      assignmentId,
      workDate,
      timeZone: "Asia/Manila",
      policyName: "Synthetic policy",
      baseRequiredMinutes: 480,
      leaveMinutes: 480,
      createdAt: at,
    })
    for (const [index, action] of actions.entries()) {
      await insert("LeaveDecision", {
        id: `decision-${id}-${index + 1}`,
        requestId: id,
        actorId:
          action === "SUBMITTED" || action === "CANCELLED"
            ? requestedById
            : action === "VERIFIED" ||
                (actions.length === 2 && action === "REJECTED")
              ? "former-head"
              : "hr",
        actionId: index === 0 ? requestKey : randomUUID(),
        action,
        fromStatus: actions[index - 1] ?? null,
        toStatus: action,
        note: "Synthetic historical decision",
        version: index + 1,
        createdAt: at,
      })
    }
  }
  async function notice(
    request: string,
    reviewer: string,
    read = true,
    type = pendingType,
  ) {
    await insert("WorkflowNotification", {
      id: `notice-${request}-${reviewer}-${type}`,
      leaveRequestId: request,
      userId: reviewer,
      type,
      summary: "Synthetic historical notice payload",
      createdAt: at,
      readAt: read ? readAt : null,
    })
  }

  await leave("replacement", "replacement-dept")
  await notice("replacement", "former-head")
  await notice("replacement", "oversight")
  await leave("disabled", "disabled-dept")
  await notice("disabled", "disabled-head")
  await db.query(
    `UPDATE "User" SET "isActive" = false WHERE id = 'disabled-head'`,
  )
  await leave("headless", "headless-dept")
  await notice("headless", "vacated-head")
  await setHead("headless-dept", null)
  await notice("headless", "hr")

  await leave("twice", "twice-dept")
  await notice("twice", "first-head")
  await setHead("twice-dept", "intermediate-head")
  await notice("twice", "intermediate-head")
  await setHead("twice-dept", "final-head")

  await leave("moved", "replacement-dept")
  await notice("moved", "former-head")
  const moved = await db.query(
    `UPDATE "Employee" SET "departmentId" = 'receiving-dept' WHERE "userId" = 'requester-moved'`,
  )
  assert.equal(moved.rowCount, 1)
  await db.query(
    `UPDATE "User" SET "departmentId" = 'receiving-dept' WHERE id = 'requester-moved'`,
  )

  await leave("already-read", "replacement-dept")
  await leave("already-unread", "replacement-dept")
  for (const [id, actions] of [
    ["verified", ["SUBMITTED", "VERIFIED"]],
    ["approved", ["SUBMITTED", "VERIFIED", "APPROVED"]],
    ["rejected", ["SUBMITTED", "REJECTED"]],
    ["cancelled", ["SUBMITTED", "CANCELLED"]],
    ["reversed", ["SUBMITTED", "VERIFIED", "APPROVED", "REVERSED"]],
  ] satisfies [string, LeaveStatus[]][]) {
    await leave(id, "replacement-dept", { actions })
    await notice(id, "former-head")
  }
  await notice("verified", "hr", true, "LEAVE_VERIFIED")
  await setHead("replacement-dept", "replacement-head")
  await notice("already-read", "replacement-head")
  await notice("already-unread", "replacement-head", false)

  await leave("self", "self-dept", {
    requester: "self-head",
    linked: "self-head",
  })
  // Legacy requester and current employee link can differ; both identities exclude self-review.
  await leave("linked", "linked-dept", { linked: "linked-head" })
  await leave("own-admin", null, { requester: "hr" })
  await leave("archived", "archived-dept")
  await notice("archived", "archived-head")
  await db.query(
    `UPDATE "User" SET "accountDeletedAt" = $1 WHERE id = 'archived-head'`,
    [at],
  )
}

type Notice = {
  id: string
  userId: string
  leaveRequestId: string
  type: string
  summary: string
  leaveVersion: number
  createdAt: string
  readAt: string | null
}

// Opt in by explicit path with an empty, disposable PostgreSQL 16 database.
test(
  "populated PostgreSQL upgrade backfills only current Leave reviewers",
  { timeout: 120_000 },
  async (t) => {
    const rawUrl = process.env.WC_I2_F01_POSTGRES_URL
    assert(rawUrl, "Set WC_I2_F01_POSTGRES_URL to the disposable database")
    const url = new URL(rawUrl)
    assert.equal(url.protocol, "postgresql:")
    assert.equal(url.hostname, "127.0.0.1")
    assert.equal(url.pathname, "/wc_i2_f01_legacy")
    assert(url.port)
    url.search = "?sslmode=disable"
    const connectionString = url.toString()
    const db = new pg.Client({ connectionString })
    await db.connect()
    t.after(() => db.end())
    async function confirmTarget() {
      const [environment] = (
        await db.query<{
          database: string
          version: number
          cluster: string
        }>(`SELECT current_database() AS database, current_setting('server_version_num')::int AS version,
              current_setting('cluster_name') AS cluster`)
      ).rows
      assert.equal(environment.database, "wc_i2_f01_legacy")
      assert.equal(environment.cluster, "nexus_wc_i2_f01")
      assert.equal(Math.floor(environment.version / 10000), 16)
      return environment
    }
    t.diagnostic(JSON.stringify(await confirmTarget()))
    assert.equal(
      (
        await db.query(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
        )
      ).rowCount,
      0,
    )
    await db.query("SET TIME ZONE 'UTC'")

    // Workspace-local temp files are also cleaned by the test runner on exit.
    const scratch = await mkdtemp(join(process.cwd(), "leave-upgrade-"))
    const staged = join(scratch, "migrations")
    await mkdir(staged)
    await cp(
      new URL("migration_lock.toml", migrationsDirectory),
      join(staged, "migration_lock.toml"),
    )
    await writeFile(
      join(scratch, "schema.prisma"),
      'datasource db {\n  provider = "postgresql"\n}\n',
    )
    const config = join(scratch, "prisma.config.mjs")
    await writeFile(
      config,
      'export default { schema: "schema.prisma", migrations: { path: "migrations" }, datasource: { url: process.env.DIRECT_URL } }\n',
    )
    const cli = createRequire(import.meta.url).resolve("prisma/build/index.js")
    const run = promisify(execFile)
    const names = await migrationNames()
    const initial = names.filter((name) => name <= boundary)
    const legacy = names.filter((name) => name <= previous)
    const upgraded = names.filter((name) => name <= fix)
    let stagedCount = 0
    async function deploy(expected: string[]) {
      for (const name of expected.slice(stagedCount))
        await cp(
          fileURLToPath(new URL(name, migrationsDirectory)),
          join(staged, name),
          { recursive: true },
        )
      stagedCount = expected.length
      await confirmTarget()
      await run(
        process.execPath,
        [cli, "migrate", "deploy", "--config", config],
        {
          env: {
            ...process.env,
            DATABASE_URL: connectionString,
            DIRECT_URL: connectionString,
          },
          windowsHide: true,
        },
      )
      const ledger = (
        await db.query<{
          migration_name: string
          checksum: string
          finished: boolean
          rolledBack: boolean
        }>(`
      SELECT migration_name, checksum, finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS "rolledBack" FROM _prisma_migrations
      ORDER BY started_at
    `)
      ).rows
      assert.deepEqual(
        ledger.map(({ migration_name }) => migration_name),
        expected,
      )
      for (const item of ledger) {
        const sql = await readFile(
          join(staged, item.migration_name, "migration.sql"),
        )
        assert.equal(
          item.checksum,
          createHash("sha256").update(sql).digest("hex"),
        )
        assert(item.finished && !item.rolledBack)
      }
    }

    const notices = async () =>
      (
        await db.query<{ value: Notice }>(
          'SELECT to_jsonb(n) AS value FROM "WorkflowNotification" n ORDER BY id',
        )
      ).rows.map(({ value }) => value)
    async function history() {
      const snapshots = []
      for (const table of [
        "LeaveRequest",
        "LeaveRequestDay",
        "LeaveDecision",
        "AttendanceAudit",
      ])
        snapshots.push(
          (
            await db.query(
              `SELECT to_jsonb(r) AS value FROM "${table}" r ORDER BY id`,
            )
          ).rows,
        )
      return snapshots
    }

    await deploy(initial)
    assert.equal(initial.length, 66)
    await seedLegacy(db)
    const original = await notices()
    await deploy(legacy)
    assert.equal(legacy.length, 77)
    assert.deepEqual(
      await notices(),
      original.map((notice) => ({ ...notice, leaveVersion: 0 })),
    )
    // A later version of an existing verification notice is also held fixed.
    await db.query(
      `
    INSERT INTO "WorkflowNotification" (id, "userId", "leaveRequestId", type, summary, "leaveVersion", "createdAt", "readAt")
    VALUES ('verification-v2', 'hr', 'verified', 'LEAVE_VERIFIED', 'Versioned historical notice', 2, $1, $2)
  `,
      [at, readAt],
    )
    const before = await notices()
    const beforeHistory = await history()

    process.env.DATABASE_URL = connectionString
    delete process.env.DIRECT_URL
    process.env.DATABASE_POOL_MAX = "4"
    process.env.JWT_SECRET = randomBytes(32).toString("base64url")
    const prisma = getPrisma()!
    const { server, origin } = await listen(
      createApp({ attendanceClock: () => new Date("2026-11-22T00:00:00Z") }),
    )
    t.after(async () => {
      await closeServer(server)
      await prisma.$disconnect()
    })
    const tokens = new Map<string, string>()
    async function call(
      user: string,
      path: string,
      expected = 200,
      method = "GET",
      body?: object,
    ) {
      let token = tokens.get(user)
      if (!token) {
        const account = await prisma.user.findUniqueOrThrow({
          where: { id: user },
        })
        token = (await issueSession(account)).token
        tokens.set(user, token)
      }
      const response = await fetch(`${origin}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      })
      assert.equal(
        response.status,
        expected,
        `${user} ${method} ${path}: ${await response.clone().text()}`,
      )
      return response
    }
    type Review = {
      id: string
      capabilities: { verify: boolean; approve: boolean; fallback: boolean }
    }
    async function review(user: string, id: string) {
      const list = await call(
        user,
        "/leave/requests?scope=team&status=SUBMITTED",
      )
      assert(
        ((await list.json()) as { requests: Review[] }).requests.some(
          (request) => request.id === id,
        ),
      )
      const detail = await call(user, `/leave/requests/${id}`)
      return ((await detail.json()) as { request: Review }).request.capabilities
    }
    async function visible(user: string, id: string) {
      const response = await call(user, inbox)
      const { notifications } = (await response.json()) as {
        notifications: {
          id: string
          entityId: string
          type: string
          readAt: string | null
        }[]
      }
      return notifications.filter(
        (item) => item.entityId === id && item.type === pendingType,
      )
    }

    // Establish the actual defect before running the new migration.
    for (const [id, user, role] of [
      ["replacement", "replacement-head", "verify"],
      ["disabled", "hr", "approve"],
    ] as const) {
      assert.equal((await review(user, id))[role], true)
      assert.deepEqual(await visible(user, id), [])
      t.diagnostic(
        `Pre-fix ${id}: ${user} has queue and detail access with zero inbox notices`,
      )
    }

    assert(
      upgraded.includes(fix),
      "The legacy PostgreSQL fixtures still lack the backfill migration",
    )
    await deploy(upgraded)
    const after = await notices()
    const oldIds = new Set(before.map(({ id }) => id))
    assert.deepEqual(
      after.filter(({ id }) => oldIds.has(id)),
      before,
    )
    assert.deepEqual(await history(), beforeHistory)
    const inserted = after.filter(({ id }) => !oldIds.has(id))
    const expected = [
      "replacement:replacement-head",
      "disabled:hr",
      "disabled:other-hr",
      "headless:other-hr",
      "twice:final-head",
      "moved:receiving-head",
      "self:hr",
      "self:other-hr",
      "linked:hr",
      "linked:other-hr",
      "own-admin:other-hr",
      "archived:hr",
      "archived:other-hr",
    ]
    assert.deepEqual(
      inserted.map((row) => `${row.leaveRequestId}:${row.userId}`).sort(),
      expected.sort(),
    )
    for (const row of inserted) {
      assert.equal(row.type, pendingType)
      assert.equal(row.leaveVersion, 0)
      assert.equal(row.readAt, null)
      assert.equal(row.summary, "A leave request is awaiting review.")
    }
    t.diagnostic(
      JSON.stringify({
        before: before.length,
        after: after.length,
        inserted: expected,
        historicalRows: beforeHistory.map((rows) => rows.length),
      }),
    )

    for (const [id, user, capability] of [
      ["replacement", "replacement-head", "verify"],
      ["disabled", "hr", "approve"],
      ["headless", "other-hr", "approve"],
      ["twice", "final-head", "verify"],
      ["moved", "receiving-head", "verify"],
      ["self", "hr", "approve"],
      ["linked", "hr", "approve"],
      ["own-admin", "other-hr", "approve"],
      ["archived", "hr", "approve"],
    ] as const) {
      assert.equal((await review(user, id))[capability], true)
      const [notice, ...extra] = await visible(user, id)
      assert(notice)
      assert.deepEqual(extra, [])
      assert.equal(notice.readAt, null)
      await call(user, `${inbox}/${notice.id}/read`, 200, "PATCH")
      assert((await visible(user, id))[0].readAt)
    }
    assert.equal(
      (await visible("replacement-head", "already-read"))[0].readAt,
      readAt,
    )
    assert.equal(
      (await visible("replacement-head", "already-unread"))[0].readAt,
      null,
    )
    assert.equal((await visible("hr", "headless"))[0].readAt, readAt)

    for (const [id, user] of [
      ["replacement", "former-head"],
      ["twice", "first-head"],
      ["twice", "intermediate-head"],
      ["moved", "replacement-head"],
    ] as const) {
      await call(user, `/leave/requests/${id}`, 404)
      assert.deepEqual(await visible(user, id), [])
    }
    await call(
      "former-head",
      `${inbox}/notice-replacement-former-head-LEAVE_SUBMITTED/read`,
      404,
      "PATCH",
    )
    await call("hr", "/leave/requests/replacement", 404)
    await call("disabled-head", inbox, 401)
    await call("archived-head", inbox, 401)
    await call("disabled-hr", inbox, 401)
    await call("archived-hr", inbox, 401)
    for (const [id, user] of [
      ["self", "self-head"],
      ["linked", "linked-head"],
      ["own-admin", "hr"],
    ] as const) {
      assert.deepEqual(await visible(user, id), [])
      const response = await call(user, `/leave/requests/${id}`)
      const { request } = (await response.json()) as { request: Review }
      assert.equal(request.capabilities.verify, false)
      assert.equal(request.capabilities.approve, false)
      await call(
        user,
        `/leave/requests/${id}/${id === "own-admin" ? "approve" : "verify"}`,
        403,
        "POST",
        {
          actionId: randomUUID(),
          expectedVersion: 1,
          note: "Synthetic denied self-review",
        },
      )
    }

    const afterRead = await notices()
    await confirmTarget()
    await db.query(await readMigration(fix))
    assert.deepEqual(await notices(), afterRead)
    await deploy(upgraded)
    assert.deepEqual(await notices(), afterRead)
    assert.deepEqual(await history(), beforeHistory)
    await assert.rejects(
      db.query(`
    INSERT INTO "WorkflowNotification" (id, "userId", "leaveRequestId", type, summary, "leaveVersion")
    VALUES ('duplicate', 'replacement-head', 'replacement', 'LEAVE_SUBMITTED', 'Duplicate fixture', 0)
  `),
      { code: "23505" },
    )
  },
)
