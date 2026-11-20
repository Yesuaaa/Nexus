import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import pg from "pg"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { payrollRunsService } from "../../../src/features/payroll/payroll-runs.service.js"
import { payrollService } from "../../../src/features/payroll/payroll.service.js"
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
  { timeout: 30_000 },
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
      "approved snapshots reject writes before and after payslip generation",
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
        const { server, origin } = await listen(createApp())
        snapshotTest.after(() => closeServer(server))
        const { token } = await issueSession(reviewer)
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
    await runPermissionAuditTest()
  },
)
