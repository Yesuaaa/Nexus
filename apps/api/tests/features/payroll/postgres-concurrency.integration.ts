import assert from "node:assert/strict"
import { randomBytes, randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { payrollRunsService } from "../../../src/features/payroll/payroll-runs.service.js"
import { payrollService } from "../../../src/features/payroll/payroll.service.js"
import { isPayrollSimulatorEnabled } from "../../../src/features/payroll/payroll-simulator.js"
import { payMongoDisbursements } from "../../../src/features/payroll/paymongo-disbursements.js"
import { disconnectPrisma, getPrisma } from "../../../src/lib/db.js"
import {
  auditPayrollDatabasePermissions,
  createPayrollAuditClient,
  expectedPayrollGuardMigrationChecksum,
  type PayrollAuditQueryClient,
} from "../../../src/lib/payroll-db-permissions-audit.js"
import { isWriteConflict } from "../../../src/lib/errors.js"
import { closeServer, listen } from "../../support/pglite-app.js"

test(
  "Payroll serializes schedule writers and same-year period generators on PostgreSQL",
  { timeout: 90_000 },
  async (t) => {
    const password = process.env.PAYROLL_POSTGRES_TEST_PASSWORD
    assert.match(password ?? "", /^[a-f\d]{32}$/)
    assert.equal(
      process.env.DATABASE_URL,
      `postgresql://payroll_91b:${password}@127.0.0.1:5432/nexus_payroll_91b?sslmode=disable`,
    )
    assert.equal(process.env.DIRECT_URL, undefined)
    assert.equal(process.env.DATABASE_POOL_MAX, "4")
    const prisma = getPrisma()!
    t.after(disconnectPrisma)
    const [identity] = await prisma.$queryRaw<
      { database: string; role: string; address: string }[]
    >`SELECT current_database() AS database, current_user AS role, host(inet_server_addr()) AS address`
    assert.deepEqual(
      { ...identity },
      {
        database: "nexus_payroll_91b",
        role: "payroll_91b",
        address: "127.0.0.1",
      },
    )
    assert.equal(await prisma.payrollConfiguration.count(), 0)

    const runPermissionAuditTest = () =>
      t.test(
        "read-only database permission audit distinguishes restricted and risky roles",
        { timeout: 15_000 },
        async () => {
          const databaseUrl = process.env.DATABASE_URL!
          const auditReader = `payroll_audit_reader_${randomBytes(4).toString("hex")}`
          const auditPrivileged = `payroll_audit_privileged_${randomBytes(4).toString("hex")}`
          const auditOwner = `payroll_audit_owner_${randomBytes(4).toString("hex")}`
          const readerPassword = randomBytes(16).toString("hex")
          const privilegedPassword = randomBytes(16).toString("hex")
          const administrator = new pg.Client({
            connectionString: databaseUrl,
            connectionTimeoutMillis: 3_000,
            statement_timeout: 5_000,
          })
          let administratorConnected = false
          let itemOwnerChanged = false
          let originalItemOwner: string | undefined
          try {
            await administrator.connect()
            administratorConnected = true
            const ownerResult = await administrator.query<{
              owner_name: string
            }>(
              `SELECT pg_get_userbyid(relowner) AS owner_name
             FROM pg_catalog.pg_class WHERE oid = '"PayrollRunItem"'::regclass`,
            )
            originalItemOwner = ownerResult.rows[0]?.owner_name
            assert.ok(originalItemOwner)
            assert.equal(originalItemOwner, "payroll_91b")

            // The disposable launcher applies SQL files directly instead of
            // recording Prisma migration metadata. Add only the ledger shape and
            // guard-migration marker needed to exercise this audit check.
            await administrator.query(`
            CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
              id varchar(36) PRIMARY KEY NOT NULL,
              checksum varchar(64) NOT NULL,
              finished_at timestamptz,
              migration_name varchar(255) NOT NULL,
              logs text,
              rolled_back_at timestamptz,
              started_at timestamptz NOT NULL DEFAULT now(),
              applied_steps_count integer NOT NULL DEFAULT 0
            )
          `)
            const guardMigrationChecksum =
              expectedPayrollGuardMigrationChecksum()
            assert.match(guardMigrationChecksum ?? "", /^[a-f\d]{64}$/)
            await administrator.query(
              `INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count)
             VALUES ($1, $2, now(), $3, 1)`,
              [
                randomBytes(18).toString("hex"),
                guardMigrationChecksum,
                "20261118160000_payroll_approved_snapshot_guard",
              ],
            )

            await administrator.query(
              `CREATE ROLE "${auditReader}" LOGIN PASSWORD '${readerPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`,
            )
            await administrator.query(
              `CREATE ROLE "${auditPrivileged}" LOGIN PASSWORD '${privilegedPassword}' CREATEDB NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOREPLICATION`,
            )
            await administrator.query(
              `CREATE ROLE "${auditOwner}" NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`,
            )
            await administrator.query(
              `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${auditReader}"`,
            )
            await administrator.query(
              `GRANT SELECT ON public."_prisma_migrations" TO "${auditReader}"`,
            )
            await administrator.query(
              `GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON "PayrollRunItem" TO "${auditPrivileged}"`,
            )
            await administrator.query(
              `GRANT CREATE ON SCHEMA public TO "${auditOwner}"`,
            )
            await administrator.query(
              `ALTER TABLE "PayrollRunItem" OWNER TO "${auditOwner}"`,
            )
            itemOwnerChanged = true
            await administrator.query(
              `GRANT "${auditOwner}" TO "${auditPrivileged}"`,
            )

            const snapshot = async () => {
              const rows = await administrator.query(`
              SELECT c.relname, pg_get_userbyid(c.relowner) AS owner_name,
                (SELECT count(*) FROM "PayrollRun") AS payroll_runs,
                (SELECT count(*) FROM "PayrollRunCalculation") AS calculations,
                (SELECT count(*) FROM "PayrollRunItem") AS items,
                (SELECT count(*) FROM "PayrollRunItemComponent") AS components,
                (SELECT count(*) FROM "PayrollPayslip") AS payslips
              FROM pg_catalog.pg_class c
              WHERE c.oid = '"PayrollRunItem"'::regclass
            `)
              return JSON.stringify(rows.rows)
            }
            const runAudit = async (roleName: string, password: string) => {
              const url = new URL(databaseUrl)
              url.username = roleName
              url.password = password
              const client = createPayrollAuditClient(url.toString())
              try {
                await client.connect()
                const auditClient: PayrollAuditQueryClient = {
                  query: async (text) => {
                    const result = await client.query(text)
                    return {
                      rows: result.rows as unknown as Record<string, unknown>[],
                    }
                  },
                }
                return await auditPayrollDatabasePermissions(auditClient)
              } finally {
                await client.end().catch(() => {})
              }
            }

            const readerStateBefore = await snapshot()
            const readerReport = await runAudit(auditReader, readerPassword)
            const readerStateAfter = await snapshot()
            assert.equal(readerReport.verdict, "PASS")
            assert.equal(readerStateAfter, readerStateBefore)
            assert.equal(
              readerReport.checks.find(
                ({ id }) => id === "financial-table-privileges",
              )?.status,
              "PASS",
              "ordinary Payroll DML permissions remain compatible with database guards",
            )
            assert.equal(
              readerReport.checks.find(
                ({ id }) => id === "approved-snapshot-triggers",
              )?.status,
              "PASS",
            )

            const privilegedStateBefore = await snapshot()
            const privilegedReport = await runAudit(
              auditPrivileged,
              privilegedPassword,
            )
            const privilegedStateAfter = await snapshot()
            assert.equal(privilegedReport.verdict, "FAIL")
            assert.equal(privilegedStateAfter, privilegedStateBefore)
            assert.equal(
              privilegedReport.checks.find(({ id }) => id === "role-privileges")
                ?.status,
              "FAIL",
            )
            assert.equal(
              privilegedReport.checks.find(
                ({ id }) => id === "privileged-memberships",
              )?.status,
              "FAIL",
            )
            assert.equal(
              privilegedReport.checks.find(
                ({ id }) => id === "financial-table-privileges",
              )?.status,
              "FAIL",
            )
            assert.equal(
              readerReport.checks.find(({ id }) => id === "row-level-security")
                ?.status,
              "NOT APPLICABLE",
            )
          } finally {
            if (administratorConnected) {
              if (itemOwnerChanged) {
                await administrator
                  .query(
                    `ALTER TABLE "PayrollRunItem" OWNER TO "${originalItemOwner}"`,
                  )
                  .catch(() => {})
              }
              await administrator
                .query(`DROP OWNED BY "${auditPrivileged}"`)
                .catch(() => {})
              await administrator
                .query(`DROP OWNED BY "${auditReader}"`)
                .catch(() => {})
              await administrator
                .query(`DROP OWNED BY "${auditOwner}"`)
                .catch(() => {})
              await administrator
                .query(
                  `DROP ROLE IF EXISTS "${auditPrivileged}", "${auditReader}", "${auditOwner}"`,
                )
                .catch(() => {})
            }
            await administrator.end().catch(() => {})
          }
        },
      )

    const user = await prisma.user.create({
      data: {
        email: "schedule-verification@payroll.test",
        role: "ADMIN",
        passwordHash: "test-only",
      },
    })
    const auth = { user, sessionId: "disposable-postgres-verification" }

    await t.test(
      "PostgreSQL lock and statement timeouts roll back pending writes",
      async () => {
        const clients = [
          new pg.Client({ connectionString: process.env.DATABASE_URL }),
          new pg.Client({ connectionString: process.env.DATABASE_URL }),
        ]
        try {
          await Promise.all(clients.map((client) => client.connect()))
          const [first, second] = clients as [pg.Client, pg.Client]
          const pids = await Promise.all(
            clients.map(
              async (client) =>
                (
                  await client.query<{ pid: number }>(
                    "SELECT pg_backend_pid() AS pid",
                  )
                ).rows[0]!.pid,
            ),
          )
          assert.notEqual(pids[0], pids[1])
          await first.query("BEGIN")
          await first.query("SELECT pg_advisory_xact_lock(848239, 1)")
          await second.query("BEGIN")
          await second.query("SET LOCAL lock_timeout = '150ms'")
          await second.query('UPDATE "User" SET email = $1 WHERE id = $2', [
            "rollback-marker@payroll.test",
            user.id,
          ])
          await assert.rejects(
            second.query("SELECT pg_advisory_xact_lock(848239, 1)"),
            { code: "55P03" },
          )
          await second.query("ROLLBACK")
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
              .email,
            user.email,
          )
          await second.query("BEGIN")
          await second.query("SET LOCAL statement_timeout = '150ms'")
          await second.query('UPDATE "User" SET email = $1 WHERE id = $2', [
            "statement-marker@payroll.test",
            user.id,
          ])
          await assert.rejects(second.query("SELECT pg_sleep(1)"), {
            code: "57014",
          })
          await second.query("ROLLBACK")
          assert.equal(
            (await prisma.user.findUniqueOrThrow({ where: { id: user.id } }))
              .email,
            user.email,
          )
        } finally {
          for (const client of clients) {
            await client.query("ROLLBACK").catch(() => {})
            await client.end()
          }
        }
      },
    )

    await t.test(
      "PostgreSQL deadlock victim rolls back and both sessions recover",
      async () => {
        const clients = [
          new pg.Client({ connectionString: process.env.DATABASE_URL }),
          new pg.Client({ connectionString: process.env.DATABASE_URL }),
        ]
        const secondMarker = await prisma.user.create({
          data: {
            email: "deadlock-marker-second@payroll.test",
            role: "ADMIN",
            passwordHash: "test-only",
          },
        })
        const markers = [user, secondMarker]
        try {
          await Promise.all(clients.map((client) => client.connect()))
          const pids = await Promise.all(
            clients.map(async (client) =>
              Number(
                (
                  await client.query<{ pid: number }>(
                    "SELECT pg_backend_pid() AS pid",
                  )
                ).rows[0]?.pid,
              ),
            ),
          )
          assert.notEqual(pids[0], pids[1])
          for (const [index, client] of clients.entries()) {
            await client.query("BEGIN")
            await client.query("SET LOCAL statement_timeout = '4s'")
            await client.query("SET LOCAL deadlock_timeout = '100ms'")
            await client.query("SELECT pg_advisory_xact_lock(848240, $1)", [
              index,
            ])
            await client.query('UPDATE "User" SET email = $1 WHERE id = $2', [
              `deadlock-committed-${index}@payroll.test`,
              markers[index]!.id,
            ])
          }

          const financialState = async () => ({
            configurations: await prisma.payrollConfiguration.count(),
            periods: await prisma.payrollPeriod.count(),
            runs: await prisma.payrollRun.count(),
            calculations: await prisma.payrollRunCalculation.count(),
            items: await prisma.payrollRunItem.count(),
            components: await prisma.payrollRunItemComponent.count(),
            payslips: await prisma.payrollPayslip.count(),
          })
          const financialStateBefore = await financialState()
          const attempt = (index: number) => {
            const pending = clients[index]!.query(
              "SELECT pg_advisory_xact_lock(848240, $1)",
              [1 - index],
            )
            return pending
              .then(async () => {
                await clients[index]!.query("COMMIT")
                return index
              })
              .catch(async (error: unknown) => {
                // A deadlock victim must explicitly leave its aborted transaction.
                await clients[index]!.query("ROLLBACK").catch(() => {})
                throw error
              })
          }

          const firstAttempt = attempt(0)
          void firstAttempt.catch(() => {})
          const deadline = Date.now() + 3_000
          for (;;) {
            const [waiter] = await prisma.$queryRaw<{ waiting: number }[]>`
              SELECT count(*)::int AS waiting FROM pg_locks
              WHERE pid = ${pids[0]!} AND locktype = 'advisory'
                AND NOT granted AND classid = 848240::oid AND objsubid = 2
            `
            if (waiter?.waiting === 1) break
            assert.ok(
              Date.now() < deadline,
              "Expected the first deadlock waiter",
            )
            await delay(25)
          }
          const secondAttempt = attempt(1)
          const attempts = await Promise.allSettled([
            firstAttempt,
            secondAttempt,
          ])
          assert.equal(
            attempts.filter((result) => result.status === "fulfilled").length,
            1,
          )
          const failed = attempts.find((result) => result.status === "rejected")
          assert.ok(failed?.status === "rejected")
          assert.equal((failed.reason as { code: string }).code, "40P01")
          const committed = attempts.find(
            (result) => result.status === "fulfilled",
          )
          assert.ok(committed?.status === "fulfilled")
          const committedIndex = committed.value
          const persistedMarkers = await prisma.user.findMany({
            where: { id: { in: markers.map(({ id }) => id) } },
            select: { id: true, email: true },
          })
          assert.deepEqual(
            new Map(persistedMarkers.map(({ id, email }) => [id, email])),
            new Map(
              markers.map(({ id }, index) => [
                id,
                index === committedIndex
                  ? `deadlock-committed-${index}@payroll.test`
                  : markers[index]!.email,
              ]),
            ),
          )
          assert.deepEqual(await financialState(), financialStateBefore)
          for (const client of clients) {
            assert.equal(
              (await client.query("SELECT 1 AS ready")).rows[0]?.ready,
              1,
            )
          }
          t.diagnostic(
            `Database-level deadlock aborted backend ${pids[attempts.findIndex((result) => result.status === "rejected")]}; only backend ${pids[committedIndex]} committed its non-payroll marker`,
          )
        } finally {
          for (const client of clients) {
            await client.query("ROLLBACK").catch(() => {})
            await client.end()
          }
        }
      },
    )

    // Hold the existing locks until PostgreSQL reports both calls waiting.
    async function compete<T, U>(
      namespace: number,
      key: number,
      operate: () => [Promise<T>, Promise<U>],
      otherLock?: readonly [namespace: number, key: number],
    ) {
      let work:
        Promise<[PromiseSettledResult<T>, PromiseSettledResult<U>]> | undefined
      try {
        await prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(${namespace}::int, ${key}::int)`
            const [otherNamespace, otherKey] = otherLock ?? [namespace, key]
            if (otherLock) {
              await tx.$executeRaw`SELECT pg_advisory_xact_lock(${otherNamespace}::int, ${otherKey}::int)`
            }
            work = Promise.allSettled(operate())
            const deadline = Date.now() + 3_000
            for (;;) {
              const waiters = await tx.$queryRaw<{ pid: number }[]>`
            SELECT pid FROM pg_locks
            WHERE locktype = 'advisory' AND NOT granted AND objsubid = 2
              AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
              AND (
                (classid = ${namespace}::oid AND objid = ${key}::oid)
                OR (classid = ${otherNamespace}::oid AND objid = ${otherKey}::oid)
              )
          `
              const pids = new Set(waiters.map(({ pid }) => pid))
              if (pids.size === 2) {
                t.diagnostic(
                  `Observed independent backend PIDs: ${[...pids].join(", ")}`,
                )
                return
              }
              assert.ok(
                Date.now() < deadline,
                "Expected two distinct PostgreSQL lock waiters",
              )
              await delay(25)
            }
          },
          { timeout: 8_000 },
        )
      } finally {
        await work
      }
      assert.ok(work)
      return work
    }

    const initial = await payrollService.createPayrollConfiguration(auth, {
      frequency: "MONTHLY",
      firstCutoffDay: null,
      currency: "PHP",
      effectiveFrom: new Date("2099-01-01"),
      changeReason: "Initial verification schedule",
      expectedLatestId: null,
    })
    const writeSchedule = (effectiveFrom: string) =>
      payrollService.createPayrollConfiguration(auth, {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date(effectiveFrom),
        changeReason: "Concurrent verification update",
        expectedLatestId: initial.configuration.id,
      })
    const schedules = await compete(848222, 1, () => [
      writeSchedule("2099-04-01"),
      writeSchedule("2099-07-01"),
    ])
    assert.deepEqual(schedules.map(({ status }) => status).sort(), [
      "fulfilled",
      "rejected",
    ])
    const rejected = schedules.find(({ status }) => status === "rejected")
    assert.ok(rejected?.status === "rejected")
    assert.match(String(rejected.reason), /Payroll schedule changed/)
    const versions = await prisma.payrollConfiguration.findMany({
      orderBy: { effectiveFrom: "asc" },
    })
    assert.equal(versions.length, 2)
    assert.equal(
      versions[0]?.effectiveTo?.getTime(),
      versions[1]!.effectiveFrom.getTime() - 86_400_000,
    )
    assert.equal(
      await prisma.workforceManagementChange.count({
        where: { subjectType: "PAYROLL_CONFIGURATION" },
      }),
      2,
    )

    // Reject only the designated fixture audit writes, after domain writes have started.
    await prisma.$executeRaw`
      ALTER TABLE "WorkforceManagementChange"
      ADD CONSTRAINT payroll_verification_audit_fault CHECK (
        ("subjectType" <> 'PAYROLL_CONFIGURATION' OR changes->>'reason' <> 'Verification rollback') AND
        ("subjectType" <> 'PAYROLL_PERIOD' OR changes->>'startDate' <> '2099-02-01')
      )
    `
    try {
      await assert.rejects(
        payrollService.createPayrollConfiguration(auth, {
          frequency: "MONTHLY",
          firstCutoffDay: null,
          currency: "PHP",
          effectiveFrom: new Date("2099-10-01"),
          changeReason: "Verification rollback",
          expectedLatestId: versions[1]!.id,
        }),
      )
      assert.deepEqual(
        await prisma.payrollConfiguration.findMany({
          orderBy: { effectiveFrom: "asc" },
        }),
        versions,
      )
      await assert.rejects(payrollRunsService.generatePeriods(auth, 2099))
      assert.equal(await prisma.payrollPeriod.count(), 0)
      assert.equal(
        await prisma.workforceManagementChange.count({
          where: {
            subjectType: { in: ["PAYROLL_CONFIGURATION", "PAYROLL_PERIOD"] },
          },
        }),
        2,
      )
    } finally {
      await prisma.$executeRaw`ALTER TABLE "WorkforceManagementChange" DROP CONSTRAINT payroll_verification_audit_fault`
    }

    const runs = await compete(848223, 2099, () => [
      payrollRunsService.generatePeriods(auth, 2099),
      payrollRunsService.generatePeriods(auth, 2099),
    ])
    const counts = []
    for (const result of runs) {
      if (result.status === "fulfilled") {
        counts.push(result.value.createdCount)
      } else {
        // The Payroll router maps a serialization failure to HTTP 409.
        if (!isWriteConflict(result.reason)) throw result.reason
        counts.push(
          (await payrollRunsService.generatePeriods(auth, 2099)).createdCount,
        )
      }
    }
    assert.deepEqual(
      counts.sort((a, b) => a - b),
      [0, 12],
    )
    const periods = await prisma.payrollPeriod.findMany({
      orderBy: { startDate: "asc" },
    })
    assert.equal(periods.length, 12)
    for (const [index, period] of periods.entries()) {
      assert.equal(
        period.startDate.toISOString().slice(0, 10),
        new Date(Date.UTC(2099, index, 1)).toISOString().slice(0, 10),
      )
      assert.equal(
        period.endDate.toISOString().slice(0, 10),
        new Date(Date.UTC(2099, index + 1, 0)).toISOString().slice(0, 10),
      )
    }
    assert.equal(
      await prisma.workforceManagementChange.count({
        where: { subjectType: "PAYROLL_PERIOD" },
      }),
      12,
    )

    // A future schedule version must preserve the historical year being regenerated.
    const [scheduleUpdate, historicalGeneration] = await compete(
      848222,
      1,
      () => [
        payrollService.createPayrollConfiguration(auth, {
          frequency: "SEMI_MONTHLY",
          firstCutoffDay: 15,
          currency: "PHP",
          effectiveFrom: new Date("2100-01-01"),
          changeReason: "Future schedule alongside historical generation",
          expectedLatestId: versions[1]!.id,
        }),
        payrollRunsService.generatePeriods(auth, 2099),
      ],
      [848223, 2099],
    )
    if (scheduleUpdate.status === "rejected") throw scheduleUpdate.reason
    if (historicalGeneration.status === "rejected")
      throw historicalGeneration.reason
    assert.equal(historicalGeneration.value.createdCount, 0)
    assert.equal(historicalGeneration.value.total, 12)
    assert.deepEqual(
      await prisma.payrollPeriod.findMany({ orderBy: { startDate: "asc" } }),
      periods,
    )
    const history = await prisma.payrollConfiguration.findMany({
      orderBy: { effectiveFrom: "asc" },
    })
    assert.deepEqual(
      history.map(({ id }) => id),
      [versions[0]!.id, versions[1]!.id, scheduleUpdate.value.configuration.id],
    )
    assert.deepEqual(history[0], versions[0])
    assert.equal(
      history[1]?.effectiveTo?.toISOString(),
      "2099-12-31T00:00:00.000Z",
    )
    assert.equal(
      history[2]?.effectiveFrom.toISOString(),
      "2100-01-01T00:00:00.000Z",
    )
    assert.equal(history[2]?.effectiveTo, null)

    const [boundaryUpdate, currentGeneration] = await compete(
      848222,
      1,
      () => [
        payrollService.createPayrollConfiguration(auth, {
          frequency: "MONTHLY",
          firstCutoffDay: null,
          currency: "PHP",
          effectiveFrom: new Date("2100-07-01"),
          changeReason: "Boundary change during generation",
          expectedLatestId: scheduleUpdate.value.configuration.id,
        }),
        payrollRunsService.generatePeriods(auth, 2100),
      ],
      [848223, 2100],
    )
    if (currentGeneration.status === "rejected") throw currentGeneration.reason
    const boundaryChanged = boundaryUpdate.status === "fulfilled"
    if (!boundaryChanged) {
      assert.match(
        String(boundaryUpdate.reason),
        /would change already-generated payroll periods/,
      )
    }
    const currentPeriods = await prisma.payrollPeriod.findMany({
      where: { startDate: { gte: new Date("2100-01-01") } },
      orderBy: { startDate: "asc" },
    })
    assert.equal(currentPeriods.length, boundaryChanged ? 18 : 24)
    assert.equal(
      currentPeriods[0]?.startDate.toISOString(),
      "2100-01-01T00:00:00.000Z",
    )
    assert.equal(
      currentPeriods.at(-1)?.endDate.toISOString(),
      "2100-12-31T00:00:00.000Z",
    )
    for (const [index, period] of currentPeriods.entries()) {
      if (index > 0) {
        assert.equal(
          period.startDate.getTime() -
            currentPeriods[index - 1]!.endDate.getTime(),
          86_400_000,
        )
      }
      assert.equal(
        period.configurationId,
        boundaryChanged && period.startDate >= new Date("2100-07-01")
          ? boundaryUpdate.value.configuration.id
          : scheduleUpdate.value.configuration.id,
      )
    }
    assert.equal(
      (await payrollRunsService.generatePeriods(auth, 2100)).createdCount,
      0,
    )
    assert.deepEqual(
      await prisma.payrollPeriod.findMany({
        where: { endDate: { lt: new Date("2100-01-01") } },
        orderBy: { startDate: "asc" },
      }),
      periods,
    )

    await t.test(
      "[PAY-CONC-002 / PAY-API-006] approved snapshots, payslips, and ownership stay immutable on PostgreSQL",
      async (snapshotTest) => {
        const reviewer = await prisma.user.create({
          data: {
            email: "reviewer@payroll.test",
            role: "ADMIN",
            passwordHash: "test-only",
          },
        })
        const reviewAuth = {
          user: reviewer,
          sessionId: "test-reviewer-session",
        }
        const employee = await prisma.employee.create({
          data: {
            employeeId: "PAYROLL-SNAPSHOT-TEST",
            fullName: "Payroll Snapshot Test",
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            startDate: new Date("2098-01-01"),
          },
        })
        await prisma.employeeCompensation.create({
          data: {
            employeeId: employee.id,
            payType: "MONTHLY",
            baseRate: "25000.00",
            currency: "PHP",
            effectiveFrom: new Date("2099-01-01"),
            createdById: user.id,
            changeReason: "Snapshot verification fixture",
          },
        })
        const run = await payrollRunsService.createRun(auth, periods[0]!.id)
        const calculated = await payrollRunsService.calculateRun(auth, run.id)
        const calculationId = calculated.latestCalculation!.id
        const item = await prisma.payrollRunItem.findFirstOrThrow({
          where: { calculationId },
        })
        const component = await prisma.payrollRunItemComponent.findFirstOrThrow(
          { where: { itemId: item.id } },
        )
        assert.equal(
          await prisma.$executeRaw`UPDATE "PayrollRunItem" SET "netAmount" = "netAmount" WHERE id = ${item.id}`,
          1,
        )
        assert.equal(
          await prisma.$executeRaw`UPDATE "PayrollRunItemComponent" SET amount = amount WHERE id = ${component.id}`,
          1,
        )
        await payrollRunsService.transitionApproval(
          auth,
          run.id,
          calculationId,
          "submit",
        )
        const approve = () =>
          payrollRunsService.transitionApproval(
            reviewAuth,
            run.id,
            calculationId,
            "approve",
          )
        const rejected = /23514[\s\S]*Approved payroll snapshots are immutable/
        const upgrading = process.env.PAYROLL_POSTGRES_TEST_UPGRADE === "1"
        const verifyApprovalWaiters = async () => {
          const waitFor = async (
            tx: Pick<typeof prisma, "$queryRaw">,
            count: number,
          ) => {
            const deadline = Date.now() + 3_000
            for (;;) {
              const waiting = await tx.$queryRaw<{ pid: number }[]>`
                SELECT DISTINCT pid FROM pg_locks
                WHERE NOT granted AND locktype IN ('transactionid', 'tuple')
                  AND cardinality(pg_blocking_pids(pid)) > 0
                  AND pid IN (SELECT pid FROM pg_stat_activity WHERE datname = current_database())
              `
              if (waiting.length === count) return waiting.map(({ pid }) => pid)
              assert.ok(
                Date.now() < deadline,
                "Expected approval and snapshot lock waiters",
              )
              await delay(25)
            }
          }
          const pending: Promise<unknown>[] = []
          try {
            await prisma.$transaction(
              async (tx) => {
                await tx.$queryRaw`SELECT id FROM "PayrollRun" WHERE id = ${run.id} FOR UPDATE`
                pending.push(approve())
                void pending[0]!.catch(() => {})
                const [approvalPid] = await waitFor(tx, 1)
                pending.push(
                  assert.rejects(
                    prisma.$executeRaw`UPDATE "PayrollRunCalculation" SET "netTotal" = "netTotal" WHERE id = ${calculationId}`,
                    rejected,
                  ),
                )
                void pending[1]!.catch(() => {})
                const waiting = await waitFor(tx, 2)
                assert.ok(waiting.includes(approvalPid!))
                snapshotTest.diagnostic(
                  `Approval and SQL write waited on independent PIDs: ${waiting.join(", ")}`,
                )
              },
              { timeout: 8_000 },
            )
            await Promise.all(pending)
          } finally {
            await Promise.allSettled(pending)
          }
          return prisma.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
        }
        const approved = upgrading
          ? await approve()
          : await verifyApprovalWaiters()
        assert.equal(approved.status, "APPROVED")

        const readSnapshot = () =>
          prisma.payrollRunCalculation.findUniqueOrThrow({
            where: { id: calculationId },
            include: {
              items: { include: { components: true } },
              approvalEvents: { orderBy: { id: "asc" } },
            },
          })
        const before = await readSnapshot()
        if (upgrading) {
          const client = new pg.Client({
            connectionString: process.env.DATABASE_URL,
            statement_timeout: 5_000,
          })
          try {
            await client.connect()
            const { rows } = await client.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM pg_trigger WHERE tgname = 'payroll_approved_calculation_guard'",
            )
            assert.equal(rows[0]?.count, 0)
            const migration = await readFile(
              new URL(
                "../../../prisma/migrations/20261118160000_payroll_approved_snapshot_guard/migration.sql",
                import.meta.url,
              ),
              "utf8",
            )
            await client.query(migration)
          } finally {
            await client.end()
          }
          assert.deepEqual(await readSnapshot(), before)
          snapshotTest.diagnostic(
            "Snapshot migration preserved existing approved financial records",
          )
        }
        const guards = await prisma.$queryRaw<
          { table_name: string; operations: string[] }[]
        >`
          SELECT event_object_table::text AS table_name,
                 array_agg(event_manipulation::text ORDER BY event_manipulation::text) AS operations
          FROM information_schema.triggers
          WHERE trigger_schema = 'public'
            AND trigger_name IN ('payroll_approved_calculation_guard', 'payroll_approved_item_guard', 'payroll_approved_component_guard')
          GROUP BY event_object_table ORDER BY event_object_table
        `
        assert.deepEqual(
          guards.map(({ table_name, operations }) => [
            table_name,
            [...operations],
          ]),
          [
            ["PayrollRunCalculation", ["DELETE", "INSERT", "UPDATE"]],
            ["PayrollRunItem", ["DELETE", "INSERT", "UPDATE"]],
            ["PayrollRunItemComponent", ["DELETE", "INSERT", "UPDATE"]],
          ],
        )
        async function checkGuard() {
          await assert.rejects(
            prisma.$executeRaw`UPDATE "PayrollRunCalculation" SET "grossTotal" = "grossTotal", "deductionsTotal" = "deductionsTotal", "netTotal" = "netTotal" WHERE id = ${calculationId}`,
            rejected,
          )
          await assert.rejects(
            prisma.$executeRaw`UPDATE "PayrollRunItem" SET "grossAmount" = "grossAmount", "deductionsAmount" = "deductionsAmount", "netAmount" = "netAmount" WHERE id = ${item.id}`,
            rejected,
          )
          await assert.rejects(
            prisma.$executeRaw`UPDATE "PayrollRunItemComponent" SET amount = amount, "componentType" = "componentType" WHERE id = ${component.id}`,
            rejected,
          )
          // Roll back the disposable fixture even if a protected statement unexpectedly succeeds.
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`
              INSERT INTO "PayrollRunCalculation"
              SELECT (jsonb_populate_record(NULL::"PayrollRunCalculation",
                to_jsonb(c) || jsonb_build_object('id', 'snapshot-probe-calculation', 'revision', c.revision + 1))).*
              FROM "PayrollRunCalculation" c WHERE c.id = ${calculationId}
            `
              assert.fail("Approved calculation insert unexpectedly succeeded")
            }),
            rejected,
          )
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`
              INSERT INTO "PayrollRunItem"
              SELECT (jsonb_populate_record(NULL::"PayrollRunItem",
                to_jsonb(i) || jsonb_build_object('id', 'snapshot-probe-item'))).*
              FROM "PayrollRunItem" i WHERE i.id = ${item.id}
            `
              assert.fail("Approved item insert unexpectedly succeeded")
            }),
            rejected,
          )
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`
              INSERT INTO "PayrollRunItemComponent"
              SELECT (jsonb_populate_record(NULL::"PayrollRunItemComponent",
                to_jsonb(c) || jsonb_build_object('id', 'snapshot-probe-component'))).*
              FROM "PayrollRunItemComponent" c WHERE c.id = ${component.id}
            `
              assert.fail("Approved component insert unexpectedly succeeded")
            }),
            rejected,
          )
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`DELETE FROM "PayrollRunCalculation" WHERE id = ${calculationId}`
              assert.fail("Approved calculation delete unexpectedly succeeded")
            }),
            rejected,
          )
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`DELETE FROM "PayrollRunItem" WHERE id = ${item.id}`
              assert.fail("Approved item delete unexpectedly succeeded")
            }),
            rejected,
          )
          await assert.rejects(
            prisma.$transaction(async (tx) => {
              await tx.$executeRaw`DELETE FROM "PayrollRunItemComponent" WHERE id = ${component.id}`
              assert.fail("Approved component delete unexpectedly succeeded")
            }),
            rejected,
          )
          assert.deepEqual(await readSnapshot(), before)
        }
        assert.equal(
          await prisma.payrollPayslip.count({ where: { itemId: item.id } }),
          0,
        )
        await checkGuard()

        // Exercise the database guard with the privileges of a non-owner DML role.
        await prisma.$executeRaw`CREATE ROLE payroll_verification_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`
        await prisma.$executeRaw`GRANT USAGE ON SCHEMA public TO payroll_verification_writer`
        await prisma.$executeRaw`GRANT SELECT, UPDATE ON "PayrollRun", "PayrollRunCalculation" TO payroll_verification_writer`
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SET LOCAL ROLE payroll_verification_writer`
            const [role] = await tx.$queryRaw<
              {
                role: string
                superuser: boolean
                writer: boolean
                trigger_admin: boolean
              }[]
            >`
            SELECT current_user AS role, rolsuper AS superuser,
              has_table_privilege(current_user, '"PayrollRunCalculation"', 'UPDATE') AS writer,
              pg_has_role(current_user, c.relowner, 'USAGE') AS trigger_admin
            FROM pg_roles, pg_class c
            WHERE rolname = current_user AND c.oid = '"PayrollRunCalculation"'::regclass
          `
            assert.deepEqual(
              { ...role },
              {
                role: "payroll_verification_writer",
                superuser: false,
                writer: true,
                trigger_admin: false,
              },
            )
            await tx.$executeRaw`UPDATE "PayrollRunCalculation" SET "netTotal" = "netTotal" WHERE id = ${calculationId}`
          }),
          rejected,
        )
        assert.deepEqual(await readSnapshot(), before)

        // A valid metadata update must roll back with a rejected snapshot write.
        const originalRun = await prisma.payrollRun.findUniqueOrThrow({
          where: { id: run.id },
        })
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`UPDATE "PayrollRun" SET "updatedAt" = "updatedAt" + interval '1 day' WHERE id = ${run.id}`
            await tx.$executeRaw`UPDATE "PayrollRunCalculation" SET "netTotal" = "netTotal" WHERE id = ${calculationId}`
          }),
          rejected,
        )
        assert.deepEqual(
          await prisma.payrollRun.findUniqueOrThrow({ where: { id: run.id } }),
          originalRun,
        )

        process.env.JWT_SECRET = randomBytes(32).toString("base64url")
        const app = createApp()
        const originalJson = app.response.json
        const { server, origin } = await listen(app)
        snapshotTest.after(() => {
          app.response.json = originalJson
          return closeServer(server)
        })
        const { token } = await issueSession(reviewer)
        const generationPath = `/api/payroll/runs/${run.id}/generate-payslips`
        let signalResponseReached: () => void = () => {}
        const responseReached = new Promise<void>((resolve) => {
          signalResponseReached = resolve
        })
        let dropResponse = true
        app.response.json = function (
          ...args: Parameters<typeof originalJson>
        ) {
          if (
            dropResponse &&
            this.req.method === "POST" &&
            this.req.originalUrl === generationPath
          ) {
            dropResponse = false
            signalResponseReached()
            this.socket?.destroy()
            return this
          }
          return originalJson.apply(this, args)
        }
        const committedButDropped = fetch(`${origin}${generationPath}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        void committedButDropped.catch(() => {})
        await responseReached
        await assert.rejects(committedButDropped)
        app.response.json = originalJson
        const committedPayslip = await prisma.payrollPayslip.findUniqueOrThrow({
          where: { itemId: item.id },
        })
        assert.equal(await prisma.payrollPayslip.count(), 1)
        assert.ok(committedPayslip.document.byteLength > 100)
        const retryAfterCommittedResponseLoss = await fetch(
          `${origin}${generationPath}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        assert.equal(retryAfterCommittedResponseLoss.status, 200)
        assert.deepEqual(await retryAfterCommittedResponseLoss.json(), {
          total: 1,
          changed: 0,
        })
        assert.deepEqual(
          await prisma.payrollPayslip.findUniqueOrThrow({
            where: { itemId: item.id },
          }),
          committedPayslip,
        )

        const [runLock] = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${run.id}) AS key`
        const holder = new pg.Client({
          connectionString: process.env.DATABASE_URL,
          statement_timeout: 5_000,
        })
        const controller = new AbortController()
        let interrupted: Promise<unknown> | undefined
        try {
          await holder.connect()
          await holder.query("BEGIN")
          await holder.query("SELECT pg_advisory_xact_lock(848225, $1)", [
            runLock!.key,
          ])
          interrupted = fetch(
            `${origin}/api/payroll/runs/${run.id}/generate-payslips`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          )
          void interrupted.catch(() => {})
          const deadline = Date.now() + 3_000
          for (;;) {
            const waiting = await holder.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND classid = 848225::oid AND objid = $1::oid",
              [runLock!.key],
            )
            if (waiting.rows[0]!.count === 1) break
            assert.ok(
              Date.now() < deadline,
              "Interrupted request must reach the server transaction",
            )
            await delay(25)
          }
          controller.abort()
          await assert.rejects(interrupted, { name: "AbortError" })
          await holder.query("COMMIT")
        } finally {
          controller.abort()
          await holder.query("ROLLBACK").catch(() => {})
          await holder.end()
          await interrupted?.catch(() => {})
        }
        const recovered = await fetch(
          `${origin}/api/payroll/runs/${run.id}/generate-payslips`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        assert.equal(recovered.status, 200)
        const recovery = (await recovered.json()) as {
          total: number
          changed: number
        }
        assert.equal(recovery.total, 1)
        assert.ok(recovery.changed === 0 || recovery.changed === 1)
        assert.equal(await prisma.payrollPayslip.count(), 1)
        const generate = () =>
          fetch(`${origin}/api/payroll/runs/${run.id}/generate-payslips`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
        const generated = await compete(848225, runLock!.key, () => [
          generate(),
          generate(),
        ])
        const changes: number[] = []
        for (const response of generated) {
          if (response.status === "rejected") throw response.reason
          assert.equal(response.value.status, 200)
          const result = (await response.value.json()) as {
            total: number
            changed: number
          }
          assert.equal(result.total, 1)
          changes.push(result.changed)
        }
        assert.deepEqual(changes, [0, 0])
        assert.equal(await prisma.payrollPayslip.count(), 1)
        const publish = () =>
          fetch(`${origin}/api/payroll/runs/${run.id}/publish-payslips`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
        const published = await compete(848225, runLock!.key, () => [
          publish(),
          publish(),
        ])
        const publishChanges: number[] = []
        for (const response of published) {
          if (response.status === "rejected") throw response.reason
          assert.equal(response.value.status, 200)
          const result = (await response.value.json()) as {
            total: number
            changed: number
          }
          assert.equal(result.total, 1)
          publishChanges.push(result.changed)
        }
        assert.deepEqual(
          publishChanges.sort((a, b) => a - b),
          [0, 1],
        )
        const firstPublished = await prisma.payrollPayslip.findUniqueOrThrow({
          where: { itemId: item.id },
        })
        assert.ok(firstPublished.publishedAt)
        assert.equal(firstPublished.publishedBy, reviewer.id)
        const activityEvents = await prisma.workforceManagementChange.findMany({
          where: {
            action: "PAYROLL_DOCUMENT_ACTIVITY",
            subjectType: "PAYROLL_RUN",
            subjectId: run.id,
          },
        })
        assert.deepEqual(
          activityEvents
            .map(({ changes }) => (changes as { activity: string }).activity)
            .sort(),
          ["GENERATED", "PUBLISHED"],
        )

        const staffA = await prisma.user.create({
          data: {
            email: "payroll-document-owner-a@payroll.test",
            role: "STAFF",
            passwordHash: "test-only",
          },
        })
        const staffB = await prisma.user.create({
          data: {
            email: "payroll-document-owner-b@payroll.test",
            role: "STAFF",
            passwordHash: "test-only",
          },
        })
        await prisma.employee.update({
          where: { id: employee.id },
          data: { userId: staffA.id },
        })
        const employeeB = await prisma.employee.create({
          data: {
            userId: staffB.id,
            employeeId: "PAYROLL-DOCUMENT-OWNER-B",
            fullName: "Payroll Document Owner B",
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            startDate: new Date("2098-01-01"),
            compensations: {
              create: {
                payType: "MONTHLY",
                baseRate: "18000.00",
                currency: "PHP",
                effectiveFrom: new Date("2099-01-01"),
                createdById: user.id,
                changeReason: "PostgreSQL payslip ownership fixture",
              },
            },
          },
        })
        const ownershipRun = await payrollRunsService.createRun(
          auth,
          periods[10]!.id,
        )
        const ownershipCalculation = await payrollRunsService.calculateRun(
          auth,
          ownershipRun.id,
        )
        const ownershipCalculationId =
          ownershipCalculation.latestCalculation!.id
        assert.equal(
          ownershipCalculation.latestCalculation!.calculatedItemCount,
          2,
        )
        await payrollRunsService.transitionApproval(
          auth,
          ownershipRun.id,
          ownershipCalculationId,
          "submit",
        )
        await payrollRunsService.transitionApproval(
          reviewAuth,
          ownershipRun.id,
          ownershipCalculationId,
          "approve",
        )
        const ownershipRunLock = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${ownershipRun.id}) AS key`
        const generateOwnership = () =>
          fetch(
            `${origin}/api/payroll/runs/${ownershipRun.id}/generate-payslips`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            },
          )
        const generatedOwnership = await generateOwnership()
        assert.equal(generatedOwnership.status, 200)
        assert.deepEqual(await generatedOwnership.json(), {
          total: 2,
          changed: 2,
        })
        const ownershipItems = await prisma.payrollRunItem.findMany({
          where: { calculationId: ownershipCalculationId },
          include: { payslip: true },
        })
        assert.equal(ownershipItems.length, 2)
        const payslipA = ownershipItems.find(
          ({ employeeId }) => employeeId === employee.id,
        )!.payslip!
        const payslipB = ownershipItems.find(
          ({ employeeId }) => employeeId === employeeB.id,
        )!.payslip!
        assert.ok(payslipA && payslipB)
        const staffTokenA = (await issueSession(staffA)).token
        const staffTokenB = (await issueSession(staffB)).token
        const staffPayslips = (staffToken: string) =>
          fetch(`${origin}/api/staff/my-payroll/payslips`, {
            headers: { Authorization: `Bearer ${staffToken}` },
          })
        const unpublishedA = await staffPayslips(staffTokenA)
        const unpublishedB = await staffPayslips(staffTokenB)
        assert.equal(unpublishedA.status, 200)
        assert.equal(unpublishedB.status, 200)
        assert.deepEqual(
          ((await unpublishedA.json()) as { rows: { id: string }[] }).rows.map(
            ({ id }) => id,
          ),
          [firstPublished.id],
        )
        assert.deepEqual(
          ((await unpublishedB.json()) as { rows: { id: string }[] }).rows,
          [],
        )
        const publishOwnership = () =>
          fetch(
            `${origin}/api/payroll/runs/${ownershipRun.id}/publish-payslips`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            },
          )
        const publishedOwnership = await compete(
          848225,
          ownershipRunLock![0]!.key,
          () => [publishOwnership(), publishOwnership()],
        )
        const ownershipPublishChanges: number[] = []
        for (const response of publishedOwnership) {
          if (response.status === "rejected") throw response.reason
          assert.equal(response.value.status, 200)
          const result = (await response.value.json()) as {
            total: number
            changed: number
          }
          assert.equal(result.total, 2)
          ownershipPublishChanges.push(result.changed)
        }
        assert.deepEqual(
          ownershipPublishChanges.sort((a, b) => a - b),
          [0, 2],
        )
        await snapshotTest.test(
          "[PAY-API-007] PostgreSQL simulated disbursement and reconciliation remain idempotent and isolated",
          async () => {
            const previousNodeEnv = process.env.NODE_ENV
            const previousSimulator = process.env.PAYROLL_LOCAL_SIMULATOR
            const prepareBatch = () =>
              fetch(`${origin}/api/payroll/disbursements`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ runId: ownershipRun.id }),
              })
            try {
              process.env.NODE_ENV = "test"
              process.env.PAYROLL_LOCAL_SIMULATOR = "false"
              assert.equal(payMongoDisbursements.enabled, false)
              const preparedResponses = await compete(
                848227,
                ownershipRunLock![0]!.key,
                () => [prepareBatch(), prepareBatch()],
              )
              const prepared = [] as {
                id: string
                totalNet: string
                employeeCount: number
              }[]
              for (const response of preparedResponses) {
                if (response.status === "rejected") throw response.reason
                assert.equal(response.value.status, 200)
                prepared.push(
                  (await response.value.json()) as (typeof prepared)[number],
                )
              }
              assert.equal(prepared[0]?.id, prepared[1]?.id)
              assert.equal(prepared[0]?.totalNet, "43000.00")
              assert.equal(prepared[0]?.employeeCount, 2)
              const batchesForRevision =
                await prisma.payrollDisbursementBatch.count({
                  where: { calculationId: ownershipCalculationId },
                })
              assert.equal(batchesForRevision, 1)
              const batch =
                await prisma.payrollDisbursementBatch.findUniqueOrThrow({
                  where: { id: prepared[0]!.id },
                  include: { items: true },
                })
              assert.equal(batch.items.length, 2)
              assert.deepEqual(
                batch.items.map(({ amount }) => amount.toFixed(2)).sort(),
                ["18000.00", "25000.00"],
              )
              const disabledSimulation = await fetch(
                `${origin}/api/payroll/disbursements/${batch.id}/items/${batch.items[0]!.id}/simulate`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    outcome: "FAILED",
                    idempotencyKey: randomUUID(),
                  }),
                },
              )
              assert.equal(disabledSimulation.status, 403)
              assert.equal(
                await prisma.payrollTransferAttempt.count({
                  where: { itemId: batch.items[0]!.id },
                }),
                0,
              )
              assert.equal(isPayrollSimulatorEnabled(), false)

              process.env.NODE_ENV = "development"
              process.env.PAYROLL_LOCAL_SIMULATOR = "true"
              assert.equal(isPayrollSimulatorEnabled(), true)
              const payoutItem = batch.items[0]!
              const destination = await fetch(
                `${origin}/api/payroll/disbursements/${batch.id}/items/${payoutItem.id}/destination`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ kind: "TEST_BANK" }),
                },
              )
              assert.equal(destination.status, 200)
              const persistedDestination =
                await prisma.payrollSandboxDestination.findUniqueOrThrow({
                  where: { itemId: payoutItem.id },
                })
              assert.equal(persistedDestination.kind, "TEST_BANK")
              assert.match(persistedDestination.lastFour, /^\d{4}$/)
              const simulationKey = randomUUID()
              const simulate = () =>
                fetch(
                  `${origin}/api/payroll/disbursements/${batch.id}/items/${payoutItem.id}/simulate`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      outcome: "FAILED",
                      idempotencyKey: simulationKey,
                    }),
                  },
                )
              const [batchLock] = await prisma.$queryRaw<
                { key: number }[]
              >`SELECT hashtext(${batch.id}) AS key`
              const simulationRace = await compete(
                848228,
                batchLock!.key,
                () => [simulate(), simulate()],
              )
              for (const response of simulationRace) {
                if (response.status === "rejected") throw response.reason
                assert.equal(response.value.status, 200)
              }
              const persistedAttempt =
                await prisma.payrollTransferAttempt.findUniqueOrThrow({
                  where: { idempotencyKey: simulationKey },
                })
              assert.equal(persistedAttempt.itemId, payoutItem.id)
              assert.equal(persistedAttempt.outcome, "FAILED")
              assert.equal(
                await prisma.payrollTransferAttempt.count({
                  where: { itemId: payoutItem.id },
                }),
                1,
              )
              assert.equal(
                (
                  await prisma.payrollDisbursementItem.aggregate({
                    where: { batchId: batch.id },
                    _sum: { amount: true },
                  })
                )._sum.amount?.toFixed(2),
                "43000.00",
              )
              const disbursementActivities =
                await prisma.workforceManagementChange.findMany({
                  where: {
                    action: "PAYROLL_DOCUMENT_ACTIVITY",
                    subjectType: "PAYROLL_RUN",
                    subjectId: ownershipRun.id,
                  },
                })
              assert.equal(
                disbursementActivities.filter(
                  ({ changes }) =>
                    (changes as { activity: string }).activity ===
                    "DISBURSEMENT_PREPARED",
                ).length,
                1,
              )
              const reconciliationPath = `/api/payroll/runs/${ownershipRun.id}/reconciliation`
              const reconciliationResponse = await fetch(
                `${origin}${reconciliationPath}`,
                { headers: { Authorization: `Bearer ${token}` } },
              )
              assert.equal(reconciliationResponse.status, 200)
              const reconciliation = (await reconciliationResponse.json()) as {
                status: string
                amounts: {
                  approved: string
                  realPaid: string
                  failed: string
                  unresolved: string
                }
                exceptions: { rows: { category: string; subjectId: string }[] }
              }
              assert.equal(reconciliation.status, "EXCEPTION")
              assert.equal(reconciliation.amounts.approved, "43000.00")
              assert.equal(reconciliation.amounts.realPaid, "0.00")
              assert.equal(
                reconciliation.amounts.failed,
                payoutItem.amount.toFixed(2),
              )
              assert.equal(reconciliation.amounts.unresolved, "43000.00")
              assert.ok(
                reconciliation.exceptions.rows.some(
                  ({ category }) => category === "FAILED_PAYOUT",
                ),
              )
              const observationPath = reconciliationPath + "/observations"
              const observe = () =>
                fetch(`${origin}${observationPath}`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                })
              const observed = await compete(
                848227,
                ownershipRunLock![0]!.key,
                () => [observe(), observe()],
              )
              for (const response of observed) {
                if (response.status === "rejected") throw response.reason
                assert.equal(response.value.status, 200)
              }
              assert.equal(
                await prisma.payrollReconciliationException.count({
                  where: { calculationId: ownershipCalculationId },
                }),
                1,
              )
              const failedException =
                await prisma.payrollReconciliationException.findFirstOrThrow({
                  where: {
                    calculationId: ownershipCalculationId,
                    category: "FAILED_PAYOUT",
                  },
                })
              const decisionPath = reconciliationPath + "/decisions"
              const requestId = randomUUID()
              const decision = () =>
                fetch(`${origin}${decisionPath}`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    subjectId: failedException.subjectId,
                    category: failedException.category,
                    version: failedException.version,
                    action: "START_REVIEW",
                    reason: "Review the failed simulated payout",
                    requestId,
                  }),
                })
              const exceptionDecisionRace = await compete(
                848227,
                ownershipRunLock![0]!.key,
                () => [decision(), decision()],
              )
              const decisionBodies: unknown[] = []
              for (const response of exceptionDecisionRace) {
                if (response.status === "rejected") throw response.reason
                assert.equal(response.value.status, 200)
                decisionBodies.push(await response.value.json())
              }
              assert.deepEqual(decisionBodies[0], decisionBodies[1])
              assert.equal(
                await prisma.payrollReconciliationDecision.count({
                  where: {
                    calculationId: ownershipCalculationId,
                    category: failedException.category,
                    subjectId: failedException.subjectId,
                  },
                }),
                1,
              )
              assert.equal(
                (
                  await prisma.payrollReconciliationException.findUniqueOrThrow(
                    {
                      where: {
                        calculationId_category_subjectId: {
                          calculationId: ownershipCalculationId,
                          category: failedException.category,
                          subjectId: failedException.subjectId,
                        },
                      },
                    },
                  )
                ).status,
                "UNDER_REVIEW",
              )
            } finally {
              if (previousNodeEnv === undefined) delete process.env.NODE_ENV
              else process.env.NODE_ENV = previousNodeEnv
              if (previousSimulator === undefined)
                delete process.env.PAYROLL_LOCAL_SIMULATOR
              else process.env.PAYROLL_LOCAL_SIMULATOR = previousSimulator
            }
          },
        )
        for (const [actorToken, ownSlip, otherSlip] of [
          [staffTokenA, payslipA, payslipB],
          [staffTokenB, payslipB, payslipA],
        ] as const) {
          const ownList = await staffPayslips(actorToken)
          assert.equal(ownList.status, 200)
          const ownRows = (await ownList.json()) as { rows: { id: string }[] }
          assert.ok(ownRows.rows.some(({ id }) => id === ownSlip.id))
          assert.ok(!ownRows.rows.some(({ id }) => id === otherSlip.id))
          const ownDetail = await fetch(
            `${origin}/api/staff/my-payroll/payslips/${ownSlip.id}`,
            { headers: { Authorization: `Bearer ${actorToken}` } },
          )
          assert.equal(ownDetail.status, 200)
          const crossDetail = await fetch(
            `${origin}/api/staff/my-payroll/payslips/${otherSlip.id}`,
            { headers: { Authorization: `Bearer ${actorToken}` } },
          )
          assert.equal(crossDetail.status, 404)
          const ownPreview = await fetch(
            `${origin}/api/staff/my-payroll/payslips/${ownSlip.id}/preview`,
            { headers: { Authorization: `Bearer ${actorToken}` } },
          )
          assert.equal(ownPreview.status, 200)
          assert.match(
            ownPreview.headers.get("content-type") ?? "",
            /application\/pdf/,
          )
          const ownPdf = Buffer.from(await ownPreview.arrayBuffer()).toString()
          assert.match(
            ownPdf,
            new RegExp(
              `Employee ID: ${ownSlip.itemId === payslipA.itemId ? employee.employeeId : employeeB.employeeId}`,
            ),
          )
          const crossPreview = await fetch(
            `${origin}/api/staff/my-payroll/payslips/${otherSlip.id}/preview`,
            { headers: { Authorization: `Bearer ${actorToken}` } },
          )
          assert.equal(crossPreview.status, 404)
        }

        const payslip = await prisma.payrollPayslip.findUniqueOrThrow({
          where: { itemId: item.id },
        })
        await checkGuard()
        assert.deepEqual(
          await prisma.payrollPayslip.findUniqueOrThrow({
            where: { itemId: item.id },
          }),
          payslip,
        )
      },
    )
    await t.test(
      "[PAY-CONC-003] PostgreSQL approval and revision races preserve one valid decision",
      { timeout: 30_000 },
      async (approvalTest) => {
        const reviewer = await prisma.user.create({
          data: {
            email: "reviewer-first@payroll.test",
            role: "ADMIN",
            passwordHash: "test-only",
          },
        })
        const reviewAuth = {
          user: reviewer,
          sessionId: "test-first-reviewer-session",
        }
        const assertSafeConflict = (error: unknown) => {
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? error.status
              : undefined
          assert.ok(
            status === 409 || isWriteConflict(error),
            `Expected HTTP conflict or PostgreSQL serialization conflict; received ${String(error)}`,
          )
        }
        const secondReviewer = await prisma.user.create({
          data: {
            email: "reviewer-second@payroll.test",
            role: "ADMIN",
            passwordHash: "test-only",
          },
        })
        const secondReviewAuth = {
          user: secondReviewer,
          sessionId: "test-second-reviewer-session",
        }
        const calculatedRun = async (periodIndex: number) => {
          const run = await payrollRunsService.createRun(
            auth,
            periods[periodIndex]!.id,
          )
          const result = await payrollRunsService.calculateRun(auth, run.id)
          assert.equal(result.latestCalculation?.status, "COMPLETE")
          assert.equal(result.latestCalculation?.calculatedItemCount, 2)
          return { run, calculationId: result.latestCalculation!.id }
        }
        const approvalRun = await calculatedRun(1)
        await payrollRunsService.transitionApproval(
          auth,
          approvalRun.run.id,
          approvalRun.calculationId,
          "submit",
        )
        await assert.rejects(
          payrollRunsService.transitionApproval(
            auth,
            approvalRun.run.id,
            approvalRun.calculationId,
            "approve",
          ),
          { status: 403 },
        )
        const [approvalLock] = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${approvalRun.run.id}) AS key`
        const simultaneousApprovals = await compete(
          848225,
          approvalLock!.key,
          () => [
            payrollRunsService.transitionApproval(
              reviewAuth,
              approvalRun.run.id,
              approvalRun.calculationId,
              "approve",
            ),
            payrollRunsService.transitionApproval(
              secondReviewAuth,
              approvalRun.run.id,
              approvalRun.calculationId,
              "approve",
            ),
          ],
        )
        assert.deepEqual(
          simultaneousApprovals.map(({ status }) => status).sort(),
          ["fulfilled", "rejected"],
        )
        const approvalFailure = simultaneousApprovals.find(
          ({ status }) => status === "rejected",
        )
        assert.equal(approvalFailure?.status, "rejected")
        assertSafeConflict(approvalFailure.reason)
        const approvedRun = await prisma.payrollRun.findUniqueOrThrow({
          where: { id: approvalRun.run.id },
        })
        assert.equal(approvedRun.status, "APPROVED")
        const approvalEvents = await prisma.payrollApprovalEvent.findMany({
          where: { calculationId: approvalRun.calculationId },
          orderBy: { action: "asc" },
        })
        assert.deepEqual(approvalEvents.map(({ action }) => action).sort(), [
          "PAYROLL_APPROVED",
          "PAYROLL_SUBMITTED",
        ])
        assert.ok(
          [reviewer.id, secondReviewer.id].includes(
            approvalEvents.find(({ action }) => action === "PAYROLL_APPROVED")!
              .actorId,
          ),
        )
        await assert.rejects(
          payrollRunsService.transitionApproval(
            reviewAuth,
            approvalRun.run.id,
            approvalRun.calculationId,
            "approve",
          ),
          { status: 409 },
        )
        assert.equal(
          await prisma.payrollApprovalEvent.count({
            where: { calculationId: approvalRun.calculationId },
          }),
          2,
        )

        const decisionRun = await calculatedRun(2)
        await payrollRunsService.transitionApproval(
          auth,
          decisionRun.run.id,
          decisionRun.calculationId,
          "submit",
        )
        const [decisionLock] = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${decisionRun.run.id}) AS key`
        const simultaneousDecisions = await compete(
          848225,
          decisionLock!.key,
          () => [
            payrollRunsService.transitionApproval(
              reviewAuth,
              decisionRun.run.id,
              decisionRun.calculationId,
              "approve",
            ),
            payrollRunsService.transitionApproval(
              secondReviewAuth,
              decisionRun.run.id,
              decisionRun.calculationId,
              "reject",
              "Controlled PostgreSQL rejection decision",
            ),
          ],
        )
        assert.deepEqual(
          simultaneousDecisions.map(({ status }) => status).sort(),
          ["fulfilled", "rejected"],
        )
        const decisionFailure = simultaneousDecisions.find(
          ({ status }) => status === "rejected",
        )
        assert.equal(decisionFailure?.status, "rejected")
        assertSafeConflict(decisionFailure.reason)
        const terminalEvents = await prisma.payrollApprovalEvent.findMany({
          where: {
            calculationId: decisionRun.calculationId,
            action: { in: ["PAYROLL_APPROVED", "PAYROLL_REJECTED"] },
          },
        })
        assert.equal(terminalEvents.length, 1)
        const decidedRun = await prisma.payrollRun.findUniqueOrThrow({
          where: { id: decisionRun.run.id },
        })
        assert.equal(
          decidedRun.status,
          terminalEvents[0]!.action === "PAYROLL_APPROVED"
            ? "APPROVED"
            : "REJECTED",
        )
        await assert.rejects(
          payrollRunsService.transitionApproval(
            terminalEvents[0]!.action === "PAYROLL_APPROVED"
              ? secondReviewAuth
              : reviewAuth,
            decisionRun.run.id,
            decisionRun.calculationId,
            terminalEvents[0]!.action === "PAYROLL_APPROVED"
              ? "reject"
              : "approve",
            "Conflicting retry after a terminal decision",
          ),
          { status: 409 },
        )
        assert.equal(
          await prisma.payrollApprovalEvent.count({
            where: { calculationId: decisionRun.calculationId },
          }),
          2,
        )

        const revisionRun = await calculatedRun(3)
        const oldRevisionId = revisionRun.calculationId
        const recalculated = await payrollRunsService.calculateRun(
          auth,
          revisionRun.run.id,
        )
        const currentRevisionId = recalculated.latestCalculation!.id
        assert.notEqual(currentRevisionId, oldRevisionId)
        await assert.rejects(
          payrollRunsService.transitionApproval(
            auth,
            revisionRun.run.id,
            oldRevisionId,
            "submit",
          ),
          { status: 409 },
        )
        assert.equal(
          await prisma.payrollApprovalEvent.count({
            where: { calculationId: oldRevisionId },
          }),
          0,
        )
        await payrollRunsService.transitionApproval(
          auth,
          revisionRun.run.id,
          currentRevisionId,
          "submit",
        )
        await assert.rejects(
          payrollRunsService.transitionApproval(
            reviewAuth,
            revisionRun.run.id,
            oldRevisionId,
            "approve",
          ),
          { status: 409 },
        )
        await payrollRunsService.transitionApproval(
          reviewAuth,
          revisionRun.run.id,
          currentRevisionId,
          "approve",
        )

        const raceRun = await calculatedRun(4)
        const [raceLock] = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${raceRun.run.id}) AS key`
        const calculationSubmissionRace = await compete(
          848225,
          raceLock!.key,
          () => [
            payrollRunsService.calculateRun(auth, raceRun.run.id),
            payrollRunsService.transitionApproval(
              auth,
              raceRun.run.id,
              raceRun.calculationId,
              "submit",
            ),
          ],
        )
        assert.deepEqual(
          calculationSubmissionRace.map(({ status }) => status).sort(),
          ["fulfilled", "rejected"],
        )
        const raceFailure = calculationSubmissionRace.find(
          ({ status }) => status === "rejected",
        )
        assert.equal(raceFailure?.status, "rejected")
        assertSafeConflict(raceFailure.reason)
        const finalRaceRun = await prisma.payrollRun.findUniqueOrThrow({
          where: { id: raceRun.run.id },
          include: {
            calculations: {
              orderBy: { revision: "asc" },
              include: { approvalEvents: true },
            },
          },
        })
        assert.ok(
          (finalRaceRun.status === "CALCULATED" &&
            finalRaceRun.calculationCount === 2 &&
            finalRaceRun.calculations[1]?.approvalEvents.length === 0) ||
            (finalRaceRun.status === "PENDING_APPROVAL" &&
              finalRaceRun.calculationCount === 1 &&
              finalRaceRun.calculations[0]?.approvalEvents.length === 1),
        )
        if (finalRaceRun.status === "CALCULATED") {
          const latestId = finalRaceRun.calculations[1]!.id
          await payrollRunsService.transitionApproval(
            auth,
            raceRun.run.id,
            latestId,
            "submit",
          )
          await payrollRunsService.transitionApproval(
            reviewAuth,
            raceRun.run.id,
            latestId,
            "approve",
          )
        } else {
          await payrollRunsService.transitionApproval(
            reviewAuth,
            raceRun.run.id,
            raceRun.calculationId,
            "approve",
          )
        }
        assert.equal(
          (
            await prisma.payrollRun.findUniqueOrThrow({
              where: { id: raceRun.run.id },
            })
          ).status,
          "APPROVED",
        )

        const competingCalculationsRun = await payrollRunsService.createRun(
          auth,
          periods[6]!.id,
        )
        const [competingCalculationsLock] = await prisma.$queryRaw<
          { key: number }[]
        >`SELECT hashtext(${competingCalculationsRun.id}) AS key`
        const competingCalculations = await compete(
          848225,
          competingCalculationsLock!.key,
          () => [
            payrollRunsService.calculateRun(auth, competingCalculationsRun.id),
            payrollRunsService.calculateRun(auth, competingCalculationsRun.id),
          ],
        )
        assert.deepEqual(
          competingCalculations.map(({ status }) => status).sort(),
          ["fulfilled", "rejected"],
        )
        const competingCalculationFailure = competingCalculations.find(
          ({ status }) => status === "rejected",
        )
        assert.equal(competingCalculationFailure?.status, "rejected")
        assertSafeConflict(competingCalculationFailure.reason)
        const persistedCompetingRun = await prisma.payrollRun.findUniqueOrThrow(
          {
            where: { id: competingCalculationsRun.id },
            include: { calculations: true },
          },
        )
        assert.equal(persistedCompetingRun.status, "CALCULATED")
        assert.equal(persistedCompetingRun.calculationCount, 1)
        assert.equal(persistedCompetingRun.calculations.length, 1)
        const retryCalculation = await payrollRunsService.calculateRun(
          auth,
          competingCalculationsRun.id,
        )
        assert.equal(retryCalculation.latestCalculation?.revision, 2)
        assert.equal(
          await prisma.payrollRunCalculation.count({
            where: { runId: competingCalculationsRun.id },
          }),
          2,
        )

        const failureRun = await calculatedRun(5)
        await payrollRunsService.transitionApproval(
          auth,
          failureRun.run.id,
          failureRun.calculationId,
          "submit",
        )
        const approvalEventCount = await prisma.payrollApprovalEvent.count({
          where: { calculationId: failureRun.calculationId },
        })
        const approvalAuditCount = await prisma.workforceManagementChange.count(
          {
            where: {
              subjectType: "PAYROLL_RUN",
              subjectId: failureRun.run.id,
            },
          },
        )
        await prisma.$executeRaw`
          CREATE FUNCTION payroll_verification_fail_approval()
          RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            IF NEW.action = 'PAYROLL_APPROVED' THEN
              RAISE EXCEPTION 'controlled approval persistence failure'
                USING ERRCODE = '23514';
            END IF;
            RETURN NEW;
          END;
          $$
        `
        await prisma.$executeRaw`
          CREATE TRIGGER payroll_verification_fail_approval
          BEFORE INSERT ON "PayrollApprovalEvent"
          FOR EACH ROW EXECUTE FUNCTION payroll_verification_fail_approval()
        `
        try {
          await assert.rejects(
            payrollRunsService.transitionApproval(
              reviewAuth,
              failureRun.run.id,
              failureRun.calculationId,
              "approve",
            ),
          )
          assert.equal(
            (
              await prisma.payrollRun.findUniqueOrThrow({
                where: { id: failureRun.run.id },
              })
            ).status,
            "PENDING_APPROVAL",
          )
          assert.equal(
            await prisma.payrollApprovalEvent.count({
              where: { calculationId: failureRun.calculationId },
            }),
            approvalEventCount,
          )
          assert.equal(
            await prisma.workforceManagementChange.count({
              where: {
                subjectType: "PAYROLL_RUN",
                subjectId: failureRun.run.id,
              },
            }),
            approvalAuditCount,
          )
        } finally {
          await prisma.$executeRaw`
            DROP TRIGGER IF EXISTS payroll_verification_fail_approval
            ON "PayrollApprovalEvent"
          `
          await prisma.$executeRaw`
            DROP FUNCTION IF EXISTS payroll_verification_fail_approval()
          `
        }
        await payrollRunsService.transitionApproval(
          reviewAuth,
          failureRun.run.id,
          failureRun.calculationId,
          "approve",
        )
        assert.equal(
          await prisma.payrollApprovalEvent.count({
            where: { calculationId: failureRun.calculationId },
          }),
          2,
        )
        approvalTest.diagnostic(
          "Concurrent decisions and calculation/submission races left one supported terminal state; persistence failure rolled back and retry succeeded.",
        )
      },
    )
    await t.test(
      "[PAY-CONC-001] PostgreSQL attendance corrections produce complete immutable payroll snapshots",
      { timeout: 35_000 },
      async (attendanceTest) => {
        const staff = await prisma.user.create({
          data: {
            email: "payroll-attendance-correction-staff@payroll.test",
            role: "STAFF",
            passwordHash: "test-only",
          },
        })
        const superadmin = await prisma.user.create({
          data: {
            email: "payroll-attendance-correction-reviewer@payroll.test",
            role: "SUPERADMIN",
            passwordHash: "test-only",
          },
        })
        const dailyEmployee = await prisma.employee.create({
          data: {
            userId: staff.id,
            employeeId: "PAYROLL-ATTENDANCE-RACE",
            fullName: "Payroll Attendance Race",
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            startDate: new Date("2099-01-01"),
            compensations: {
              create: {
                payType: "DAILY",
                baseRate: "1200.00",
                currency: "PHP",
                effectiveFrom: new Date("2099-01-01"),
                createdById: user.id,
                changeReason: "Controlled PostgreSQL attendance race fixture",
              },
            },
          },
        })
        const policy = await prisma.attendancePolicy.create({
          data: {
            name: "Payroll PostgreSQL race policy",
            timeZone: "Asia/Manila",
            days: {
              create: Array.from({ length: 7 }, (_, weekday) => ({
                weekday,
                isWorkingDay: true,
                requiredMinutes: 420,
              })),
            },
          },
        })
        const assignment = await prisma.attendancePolicyAssignment.create({
          data: {
            employeeId: dailyEmployee.id,
            policyId: policy.id,
            effectiveFrom: new Date("2099-12-01"),
            effectiveUntil: new Date("2100-01-01"),
          },
        })
        const fixtureSessions = new Map<
          number,
          { id: string; startedAt: Date; endedAt: Date }
        >()
        for (let day = 1; day <= 31; day += 1) {
          const workDate = new Date(Date.UTC(2099, 11, day))
          const startedAt = new Date(Date.UTC(2099, 11, day, 1))
          const endedAt = new Date(
            Date.UTC(
              2099,
              11,
              day,
              day === 1 || day === 2 ? 7 : 8,
              day === 1 || day === 2 ? 59 : 0,
            ),
          )
          const workday = await prisma.attendanceWorkday.create({
            data: {
              employeeId: dailyEmployee.id,
              assignmentId: assignment.id,
              policyName: policy.name,
              workDate,
              timeZone: policy.timeZone,
              isWorkingDay: true,
              requiredMinutes: 420,
              unpaidBreaksEnabled: policy.unpaidBreaksEnabled,
              overnightRequiresReview: policy.overnightRequiresReview,
            },
          })
          const session = await prisma.attendanceWorkSession.create({
            data: {
              employeeId: dailyEmployee.id,
              workdayId: workday.id,
              startedAt,
              endedAt,
            },
          })
          fixtureSessions.set(day, { id: session.id, startedAt, endedAt })
        }
        const attendanceRun = await payrollRunsService.createRun(
          auth,
          periods[11]!.id,
        )
        const makeCorrection = async (day: number) => {
          const session = fixtureSessions.get(day)!
          return prisma.attendanceAdjustment.create({
            data: {
              requestKey: randomUUID(),
              type: "CORRECTION",
              status: "PENDING",
              employeeId: dailyEmployee.id,
              sessionId: session.id,
              originalSession: {
                startedAt: session.startedAt.toISOString(),
                endedAt: session.endedAt.toISOString(),
                breaks: [],
              },
              proposedStartedAt: session.startedAt,
              proposedEndedAt: new Date(Date.UTC(2099, 11, day, 8)),
              reason: "Correct the recorded end time to the scheduled shift",
              requestedById: staff.id,
            },
          })
        }
        const correctionBeforeCalculation = await makeCorrection(1)
        const correctionDuringCalculation = await makeCorrection(2)
        process.env.JWT_SECRET = randomBytes(32).toString("base64url")
        const { token } = await issueSession(superadmin)
        const attendanceApp = createApp({
          attendanceClock: () => new Date("2100-01-01T00:00:00.000Z"),
        })
        const { server, origin } = await listen(attendanceApp)
        attendanceTest.after(() => closeServer(server))
        const review = (adjustmentId: string) =>
          fetch(`${origin}/api/attendance/adjustments/${adjustmentId}/review`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              decision: "APPROVED",
              note: "Verified work session correction",
            }),
          })
        const beforeResponse = await review(correctionBeforeCalculation.id)
        assert.equal(beforeResponse.status, 200)
        const firstCorrectedSession =
          await prisma.attendanceWorkSession.findUniqueOrThrow({
            where: { id: fixtureSessions.get(1)!.id },
          })
        assert.equal(
          firstCorrectedSession.endedAt?.toISOString(),
          new Date(Date.UTC(2099, 11, 1, 8)).toISOString(),
        )

        await prisma.$executeRaw`
          CREATE FUNCTION payroll_verification_wait_for_attendance()
          RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            PERFORM pg_advisory_xact_lock(848299, 1);
            RETURN NEW;
          END;
          $$
        `
        await prisma.$executeRaw`
          CREATE TRIGGER payroll_verification_wait_for_attendance
          BEFORE INSERT ON "PayrollRunCalculation"
          FOR EACH ROW EXECUTE FUNCTION payroll_verification_wait_for_attendance()
        `
        const holder = new pg.Client({
          connectionString: process.env.DATABASE_URL,
          statement_timeout: 5_000,
        })
        let connected = false
        let calculationPromise:
          ReturnType<typeof payrollRunsService.calculateRun> | undefined
        try {
          await holder.connect()
          connected = true
          await holder.query("SELECT pg_advisory_lock(848299, 1)")
          const inFlightCalculation = payrollRunsService.calculateRun(
            auth,
            attendanceRun.id,
          )
          calculationPromise = inFlightCalculation
          void inFlightCalculation.catch(() => {})
          const deadline = Date.now() + 5_000
          for (;;) {
            const waiting = await holder.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND classid = 848299::oid AND objid = 1::oid AND objsubid = 2",
            )
            if (waiting.rows[0]?.count === 1) break
            assert.ok(
              Date.now() < deadline,
              "Calculation must reach the revision insert after reading attendance",
            )
            await delay(25)
          }
          const duringResponse = await review(correctionDuringCalculation.id)
          assert.equal(duringResponse.status, 200)
          const correctedDuringRead =
            await prisma.attendanceWorkSession.findUniqueOrThrow({
              where: { id: fixtureSessions.get(2)!.id },
            })
          assert.equal(
            correctedDuringRead.endedAt?.toISOString(),
            new Date(Date.UTC(2099, 11, 2, 8)).toISOString(),
          )
          await holder.query("SELECT pg_advisory_unlock(848299, 1)")
          const firstOutcome = await Promise.allSettled([inFlightCalculation])
          const firstResult = firstOutcome[0]!
          let firstRevisionId: string | undefined
          let firstAttendanceSnapshot: unknown
          if (firstResult.status === "fulfilled") {
            firstRevisionId = firstResult.value.latestCalculation!.id
            const firstRevision =
              await prisma.payrollRunCalculation.findUniqueOrThrow({
                where: { id: firstRevisionId },
                include: { items: true },
              })
            assert.equal(firstRevision.revision, 1)
            assert.equal(firstRevision.status, "REVIEW_REQUIRED")
            assert.equal(firstRevision.grossTotal.toFixed(2), "43000.00")
            const firstDailyItem = firstRevision.items.find(
              ({ employeeId }) => employeeId === dailyEmployee.id,
            )!
            firstAttendanceSnapshot = firstDailyItem.attendanceSnapshot
            assert.equal(firstDailyItem.status, "REVIEW_REQUIRED")
            assert.equal(firstDailyItem.grossAmount?.toFixed(2), "36000.00")
            const snapshot = firstDailyItem.attendanceSnapshot as {
              workdays: {
                workDate: string
                sessions: { id: string; endedAt: string | null }[]
              }[]
            }
            const snapshotDay1 = snapshot.workdays.find(
              ({ workDate }) => workDate === "2099-12-01",
            )
            const snapshotDay2 = snapshot.workdays.find(
              ({ workDate }) => workDate === "2099-12-02",
            )
            assert.equal(
              snapshotDay1?.sessions[0]?.endedAt,
              new Date(Date.UTC(2099, 11, 1, 8)).toISOString(),
            )
            assert.equal(
              snapshotDay2?.sessions[0]?.endedAt,
              fixtureSessions.get(2)!.endedAt.toISOString(),
            )
          } else {
            assert.ok(
              isWriteConflict(firstResult.reason),
              "A conflicting attendance snapshot must fail with a safe serialization conflict",
            )
            assert.equal(
              await prisma.payrollRunCalculation.count({
                where: { runId: attendanceRun.id },
              }),
              0,
            )
            assert.equal(
              await prisma.payrollRunItem.count({
                where: { calculation: { runId: attendanceRun.id } },
              }),
              0,
            )
            assert.equal(
              (
                await prisma.payrollRun.findUniqueOrThrow({
                  where: { id: attendanceRun.id },
                })
              ).status,
              "DRAFT",
            )
          }
          const recalculated = await payrollRunsService.calculateRun(
            auth,
            attendanceRun.id,
          )
          assert.equal(recalculated.latestCalculation?.status, "COMPLETE")
          assert.equal(recalculated.latestCalculation?.grossTotal, "80200.00")
          assert.equal(recalculated.latestCalculation?.calculatedItemCount, 3)
          assert.equal(
            await prisma.payrollRunCalculation.count({
              where: { runId: attendanceRun.id },
            }),
            firstRevisionId ? 2 : 1,
          )
          const finalDailyItem = await prisma.payrollRunItem.findFirstOrThrow({
            where: {
              calculationId: recalculated.latestCalculation!.id,
              employeeId: dailyEmployee.id,
            },
          })
          assert.equal(finalDailyItem.status, "CALCULATED")
          assert.equal(finalDailyItem.grossAmount?.toFixed(2), "37200.00")
          if (firstRevisionId) {
            const firstPersistedItem =
              await prisma.payrollRunItem.findFirstOrThrow({
                where: {
                  calculationId: firstRevisionId,
                  employeeId: dailyEmployee.id,
                },
              })
            assert.deepEqual(
              firstPersistedItem.attendanceSnapshot,
              firstAttendanceSnapshot,
            )
          }
          const finalSnapshot = finalDailyItem.attendanceSnapshot as {
            workdays: {
              workDate: string
              sessions: { endedAt: string | null }[]
            }[]
          }
          for (const [day, dateKey] of [
            [1, "2099-12-01"],
            [2, "2099-12-02"],
          ] as const) {
            assert.equal(
              finalSnapshot.workdays.find(
                ({ workDate }) => workDate === dateKey,
              )?.sessions[0]?.endedAt,
              new Date(Date.UTC(2099, 11, day, 8)).toISOString(),
            )
          }
          const corrections = await prisma.attendanceAdjustment.findMany({
            where: {
              id: {
                in: [
                  correctionBeforeCalculation.id,
                  correctionDuringCalculation.id,
                ],
              },
            },
            orderBy: { id: "asc" },
          })
          assert.ok(
            corrections.every(
              ({ status, reviewedById }) =>
                status === "APPROVED" && reviewedById === superadmin.id,
            ),
          )
          attendanceTest.diagnostic(
            firstRevisionId
              ? "The in-flight SERIALIZABLE calculation committed a consistent pre-correction snapshot; the later revision used both committed corrections and exact PHP totals."
              : "PostgreSQL rejected the in-flight calculation atomically after the attendance correction; retry used both committed corrections and exact PHP totals.",
          )
        } finally {
          await holder
            .query("SELECT pg_advisory_unlock(848299, 1)")
            .catch(() => {})
          if (calculationPromise) await calculationPromise.catch(() => {})
          if (connected) await holder.end()
          await prisma.$executeRaw`
            DROP TRIGGER IF EXISTS payroll_verification_wait_for_attendance
            ON "PayrollRunCalculation"
          `
          await prisma.$executeRaw`
            DROP FUNCTION IF EXISTS payroll_verification_wait_for_attendance()
          `
        }
      },
    )
    await runPermissionAuditTest()
  },
)
