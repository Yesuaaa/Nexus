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
    const user = await prisma.user.create({
      data: {
        email: "schedule-verification@payroll.test",
        role: "ADMIN",
        passwordHash: "test-only",
      },
    })
    const auth = { user, sessionId: "disposable-postgres-verification" }

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
        const response = await fetch(
          `${origin}/api/payroll/runs/${run.id}/generate-payslips`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        assert.equal(response.status, 200, await response.text())
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
  },
)
