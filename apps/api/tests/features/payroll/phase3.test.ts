import assert from "node:assert/strict"
import { test } from "node:test"
import {
  Role,
  WorkforceManagementAction,
} from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Payroll Phase 3 period and run reads enforce the existing Payroll role split",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)

    async function actor(
      key: string,
      role: Role,
      options: { active?: boolean; deleted?: boolean } = {},
    ) {
      const user = await prisma.user.create({
        data: {
          id: `payroll-phase3-${key}`,
          role,
          email: `${key}@payroll-phase3.test`,
          passwordHash: "not-a-real-password-hash",
          isActive: options.active ?? true,
          accountDeletedAt: options.deleted
            ? new Date("2026-11-15T00:00:00.000Z")
            : null,
        },
      })
      return {
        user,
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
        },
      }
    }

    const admin = await actor("admin", Role.ADMIN)
    const superadmin = await actor("superadmin", Role.SUPERADMIN)
    const staff = await actor("staff", Role.STAFF)
    const client = await actor("client", Role.USER)
    const inactiveAdmin = await actor("inactive-admin", Role.ADMIN, {
      active: false,
    })
    const deletedSuperadmin = await actor(
      "deleted-superadmin",
      Role.SUPERADMIN,
      { deleted: true },
    )

    for (const path of ["/payroll/periods", "/payroll/runs"]) {
      for (const user of [admin, superadmin]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(response.status, 200, `${path} should be readable`)
      }
      for (const user of [staff, client]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(response.status, 403, `${path} should deny this role`)
      }
      for (const user of [inactiveAdmin, deletedSuperadmin]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(response.status, 401, `${path} should deny this account`)
      }
      const anonymous = await fetch(`${base}${path}`)
      assert.equal(anonymous.status, 401, `${path} should require a session`)
    }
  },
)

test(
  "Admin can generate periods, create and recalculate a draft run with immutable revisions",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await actor(prisma, "phase3-run-admin", Role.ADMIN)
    const superadmin = await actor(
      prisma,
      "phase3-run-superadmin",
      Role.SUPERADMIN,
    )
    const staff = await actor(prisma, "phase3-run-staff", Role.STAFF)
    const client = await actor(prisma, "phase3-run-client", Role.USER)

    await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Phase 3 route fixture",
      },
    })

    const generatedResponse = await fetch(`${base}/payroll/periods`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    assert.equal(generatedResponse.status, 201)
    const generated = (await generatedResponse.json()) as {
      year: number
      createdCount: number
      total: number
      rows: { id: string; startDate: string; endDate: string }[]
    }
    assert.equal(generated.year, 2026)
    assert.equal(generated.createdCount, 12)
    assert.equal(generated.total, 12)

    const duplicateGeneration = await fetch(`${base}/payroll/periods`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    assert.equal(duplicateGeneration.status, 201)
    assert.equal(
      ((await duplicateGeneration.json()) as { createdCount: number })
        .createdCount,
      0,
    )

    const invalidYear = await fetch(`${base}/payroll/periods`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ year: 1899 }),
    })
    assert.equal(invalidYear.status, 400)

    const periodsResponse = await fetch(`${base}/payroll/periods?year=2026`, {
      headers: admin.headers,
    })
    assert.equal(periodsResponse.status, 200)
    assert.equal(
      ((await periodsResponse.json()) as { total: number }).total,
      12,
    )

    const november = generated.rows.find(
      (period) => period.startDate === "2026-11-01",
    )
    assert.ok(november)
    const runResponse = await fetch(`${base}/payroll/runs`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: november.id }),
    })
    assert.equal(runResponse.status, 201)
    const run = (await runResponse.json()) as { id: string; status: string }
    assert.equal(run.status, "DRAFT")

    const duplicateRun = await fetch(`${base}/payroll/runs`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: november.id }),
    })
    assert.equal(duplicateRun.status, 409)

    const employee = await prisma.employee.create({
      data: {
        employeeId: "PHASE3-EMP-01",
        fullName: "Payroll Test Employee",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
      },
    })
    await prisma.employeeCompensation.create({
      data: {
        employeeId: employee.id,
        payType: "MONTHLY",
        baseRate: "25000.00",
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Phase 3 calculation fixture",
        components: {
          create: [
            {
              type: "ALLOWANCE",
              name: "Internet",
              amount: "500.00",
              calculationType: "FIXED",
            },
          ],
        },
      },
    })

    const calculatedResponse = await fetch(
      `${base}/payroll/runs/${run.id}/calculate`,
      { method: "POST", headers: admin.headers },
    )
    assert.equal(calculatedResponse.status, 200)
    const calculated = (await calculatedResponse.json()) as {
      status: string
      latestCalculation: {
        revision: number
        status: string
        grossTotal: string
      }
    }
    assert.equal(calculated.status, "CALCULATED")
    assert.equal(calculated.latestCalculation.revision, 1)
    assert.equal(calculated.latestCalculation.status, "COMPLETE")
    assert.equal(calculated.latestCalculation.grossTotal, "25500.00")

    const itemsResponse = await fetch(`${base}/payroll/runs/${run.id}/items`, {
      headers: admin.headers,
    })
    assert.equal(itemsResponse.status, 200)
    const items = (await itemsResponse.json()) as {
      total: number
      rows: {
        id: string
        employeeName: string
        grossAmount: string
        compensationSnapshot: { id: string; baseRate: string }[]
      }[]
    }
    assert.equal(items.total, 1)
    assert.equal(items.rows[0]?.employeeName, "Payroll Test Employee")
    assert.equal(items.rows[0]?.grossAmount, "25500.00")
    assert.equal(items.rows[0]?.compensationSnapshot[0]?.baseRate, "25000.00")

    const itemResponse = await fetch(
      `${base}/payroll/runs/${run.id}/items/${items.rows[0]!.id}`,
      { headers: admin.headers },
    )
    assert.equal(itemResponse.status, 200)

    await prisma.employee.update({
      where: { id: employee.id },
      data: { fullName: "Updated Payroll Test Employee" },
    })
    const recalculatedResponse = await fetch(
      `${base}/payroll/runs/${run.id}/calculate`,
      { method: "POST", headers: admin.headers },
    )
    assert.equal(recalculatedResponse.status, 200)
    const recalculated = (await recalculatedResponse.json()) as {
      calculationCount: number
      calculationHistory: { revision: number; id: string }[]
    }
    assert.equal(recalculated.calculationCount, 2)
    assert.deepEqual(
      recalculated.calculationHistory.map(({ revision }) => revision),
      [2, 1],
    )

    const latestItemsResponse = await fetch(
      `${base}/payroll/runs/${run.id}/items`,
      { headers: admin.headers },
    )
    const latestItems = (await latestItemsResponse.json()) as {
      rows: { employeeName: string }[]
    }
    assert.equal(
      latestItems.rows[0]?.employeeName,
      "Updated Payroll Test Employee",
    )

    const firstRevisionItemsResponse = await fetch(
      `${base}/payroll/runs/${run.id}/items?calculationId=${recalculated.calculationHistory[1]!.id}`,
      { headers: admin.headers },
    )
    const firstRevisionItems = (await firstRevisionItemsResponse.json()) as {
      rows: { employeeName: string }[]
    }
    assert.equal(
      firstRevisionItems.rows[0]?.employeeName,
      "Payroll Test Employee",
    )

    const superadminRead = await fetch(`${base}/payroll/runs/${run.id}`, {
      headers: superadmin.headers,
    })
    assert.equal(superadminRead.status, 200)
    const superadminCalculate = await fetch(
      `${base}/payroll/runs/${run.id}/calculate`,
      { method: "POST", headers: superadmin.headers },
    )
    assert.equal(superadminCalculate.status, 403)
    for (const user of [staff, client]) {
      const read = await fetch(`${base}/payroll/runs/${run.id}`, {
        headers: user.headers,
      })
      assert.equal(read.status, 403)
      const mutate = await fetch(`${base}/payroll/runs`, {
        method: "POST",
        headers: { ...user.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: november.id }),
      })
      assert.equal(mutate.status, 403)
    }

    const payrollEvents = await prisma.workforceManagementChange.findMany({
      where: { subjectType: "PAYROLL_RUN", subjectId: run.id },
      orderBy: { createdAt: "asc" },
    })
    assert.deepEqual(
      payrollEvents.map(({ action }) => action),
      [
        WorkforceManagementAction.PAYROLL_RUN_CREATED,
        WorkforceManagementAction.PAYROLL_CALCULATED,
        WorkforceManagementAction.PAYROLL_RECALCULATED,
      ],
    )
    for (const event of payrollEvents) {
      const changes = event.changes as Record<string, unknown>
      assert.equal(Object.hasOwn(changes, "grossTotal"), false)
      assert.equal(Object.hasOwn(changes, "baseRate"), false)
      assert.equal(Object.hasOwn(changes, "amount"), false)
    }
  },
)

test(
  "payroll migration declares uniqueness, money, range, and foreign-key constraints",
  { timeout: 120_000 },
  async (t) => {
    const { prisma } = await startPgliteApp(t)
    const admin = await actor(prisma, "phase3-integrity-admin", Role.ADMIN)
    const configuration = await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Persistence integrity fixture",
      },
    })
    const periodInput = {
      configurationId: configuration.id,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-01-31T00:00:00.000Z"),
      cutoffLabel: "2026-01",
      createdById: admin.user.id,
    }
    const period = await prisma.payrollPeriod.create({ data: periodInput })
    const runInput = { periodId: period.id, createdById: admin.user.id }
    const run = await prisma.payrollRun.create({ data: runInput })
    const calculationInput = {
      runId: run.id,
      revision: 1,
      status: "BLOCKED" as const,
      createdById: admin.user.id,
      inputSnapshot: {},
    }
    const calculation = await prisma.payrollRunCalculation.create({
      data: calculationInput,
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "PHASE3-INTEGRITY-EMP",
        fullName: "Payroll Integrity Employee",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
      },
    })
    const itemInput = {
      calculationId: calculation.id,
      employeeId: employee.id,
      employeeNumberSnapshot: employee.employeeId,
      employeeNameSnapshot: employee.fullName,
      employmentTypeSnapshot: employee.employmentType,
      status: "BLOCKED" as const,
      compensationSnapshot: [],
      attendanceSnapshot: {},
      warnings: [],
      blocks: [],
    }
    await prisma.payrollRunItem.create({ data: itemInput })
    const uniqueIndexes = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
        'payroll_period_configuration_boundary_uq',
        'payroll_run_period_uq',
        'payroll_run_calculation_revision_uq',
        'payroll_run_item_calculation_employee_uq'
      )`
    assert.deepEqual(
      uniqueIndexes.map(({ indexname }) => indexname).sort(),
      [
        "payroll_period_configuration_boundary_uq",
        "payroll_run_period_uq",
        "payroll_run_calculation_revision_uq",
        "payroll_run_item_calculation_employee_uq",
      ].sort(),
    )
    const integrityConstraints = await prisma.$queryRaw<
      { conname: string }[]
    >`SELECT conname::text AS conname FROM pg_constraint WHERE conname IN (
      'payroll_period_date_order',
      'payroll_run_calculation_totals_nonnegative',
      'PayrollPeriod_configurationId_fkey',
      'PayrollRun_periodId_fkey',
      'PayrollRunCalculation_runId_fkey',
      'PayrollRunItem_calculationId_fkey',
      'PayrollRunItem_employeeId_fkey'
    )`
    assert.deepEqual(
      integrityConstraints.map(({ conname }) => conname).sort(),
      [
        "PayrollPeriod_configurationId_fkey",
        "PayrollRunCalculation_runId_fkey",
        "PayrollRunItem_calculationId_fkey",
        "PayrollRunItem_employeeId_fkey",
        "PayrollRun_periodId_fkey",
        "payroll_period_date_order",
        "payroll_run_calculation_totals_nonnegative",
      ].sort(),
    )
    const moneyColumns = await prisma.$queryRaw<
      {
        table_name: string
        column_name: string
        numeric_precision: number
        numeric_scale: number
      }[]
    >`SELECT table_name, column_name, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_name IN ('PayrollRunCalculation', 'PayrollRunItem')
         AND column_name IN ('grossTotal', 'grossAmount')
       ORDER BY table_name, column_name`
    assert.deepEqual(moneyColumns, [
      {
        table_name: "PayrollRunCalculation",
        column_name: "grossTotal",
        numeric_precision: 14,
        numeric_scale: 2,
      },
      {
        table_name: "PayrollRunItem",
        column_name: "grossAmount",
        numeric_precision: 14,
        numeric_scale: 2,
      },
    ])
    const storedAmount = await prisma.payrollRunCalculation.findUniqueOrThrow({
      where: { id: calculation.id },
      select: { grossTotal: true },
    })
    assert.equal(storedAmount.grossTotal.toFixed(2), "0.00")
  },
)

test(
  "run totals include complete employees and exclude review or blocked amounts",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await actor(prisma, "phase3-totals-admin", Role.ADMIN)
    await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Known totals fixture",
      },
    })
    const generatedResponse = await fetch(`${base}/payroll/periods`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    const generated = (await generatedResponse.json()) as {
      rows: { id: string; startDate: string }[]
    }
    const november = generated.rows.find(
      ({ startDate }) => startDate === "2026-11-01",
    )
    assert.ok(november)
    const runResponse = await fetch(`${base}/payroll/runs`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: november.id }),
    })
    const run = (await runResponse.json()) as { id: string }

    const completeEmployee = await prisma.employee.create({
      data: {
        employeeId: "PHASE3-KNOWN-EMP",
        fullName: "Known Payroll Employee",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
      },
    })
    await prisma.employeeCompensation.create({
      data: {
        employeeId: completeEmployee.id,
        payType: "MONTHLY",
        baseRate: "10000.00",
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Known calculation fixture",
      },
    })

    const blockedEmployee = await prisma.employee.create({
      data: {
        employeeId: "PHASE3-BLOCKED-EMP",
        fullName: "Blocked Payroll Employee",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
      },
    })
    for (const [effectiveFrom, effectiveTo, baseRate] of [
      ["2026-01-01", "2026-11-15", "12000.00"],
      ["2026-11-16", null, "13000.00"],
    ] as const)
      await prisma.employeeCompensation.create({
        data: {
          employeeId: blockedEmployee.id,
          payType: "MONTHLY",
          baseRate,
          currency: "PHP",
          effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
          effectiveTo: effectiveTo
            ? new Date(`${effectiveTo}T00:00:00.000Z`)
            : null,
          createdById: admin.user.id,
          changeReason: "Unsupported revision fixture",
        },
      })

    const calculatedResponse = await fetch(
      `${base}/payroll/runs/${run.id}/calculate`,
      { method: "POST", headers: admin.headers },
    )
    assert.equal(calculatedResponse.status, 200)
    const calculated = (await calculatedResponse.json()) as {
      latestCalculation: {
        status: string
        grossTotal: string
        calculatedItemCount: number
        blockedItemCount: number
      }
    }
    assert.equal(calculated.latestCalculation.status, "REVIEW_REQUIRED")
    assert.equal(calculated.latestCalculation.grossTotal, "10000.00")
    assert.equal(calculated.latestCalculation.calculatedItemCount, 1)
    assert.equal(calculated.latestCalculation.blockedItemCount, 1)

    const itemsResponse = await fetch(`${base}/payroll/runs/${run.id}/items`, {
      headers: admin.headers,
    })
    const items = (await itemsResponse.json()) as {
      rows: { status: string; grossAmount: string | null }[]
    }
    assert.deepEqual(
      items.rows.map(({ status, grossAmount }) => [status, grossAmount]),
      [
        ["BLOCKED", null],
        ["CALCULATED", "10000.00"],
      ],
    )
  },
)

test(
  "failed calculations roll back and append a payroll-safe failure event",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await actor(prisma, "phase3-failure-admin", Role.ADMIN)
    await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Failure audit fixture",
      },
    })
    const generatedResponse = await fetch(`${base}/payroll/periods`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ year: 2026 }),
    })
    const generated = (await generatedResponse.json()) as {
      rows: { id: string }[]
    }
    const runResponse = await fetch(`${base}/payroll/runs`, {
      method: "POST",
      headers: { ...admin.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ periodId: generated.rows[0]!.id }),
    })
    const run = (await runResponse.json()) as { id: string }

    const failed = await fetch(`${base}/payroll/runs/${run.id}/calculate`, {
      method: "POST",
      headers: admin.headers,
    })
    assert.equal(failed.status, 409)
    const persistedRun = await prisma.payrollRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    assert.equal(persistedRun.status, "DRAFT")
    assert.equal(persistedRun.calculationCount, 0)
    assert.equal(
      await prisma.payrollRunCalculation.count({ where: { runId: run.id } }),
      0,
    )

    const failure = await prisma.workforceManagementChange.findFirstOrThrow({
      where: { subjectType: "PAYROLL_RUN", subjectId: run.id },
      orderBy: { createdAt: "desc" },
    })
    assert.equal(
      failure.action,
      WorkforceManagementAction.PAYROLL_CALCULATION_FAILED,
    )
    assert.deepEqual(failure.changedFields, [
      "attemptId",
      "revision",
      "failureCode",
    ])
    const changes = failure.changes as Record<string, unknown>
    assert.equal(changes.failureCode, "CALCULATION_INPUT_INVALID")
    assert.equal(changes.revision, 1)
    assert.equal(Object.hasOwn(changes, "baseRate"), false)
    assert.equal(Object.hasOwn(changes, "grossTotal"), false)
    assert.equal(Object.hasOwn(changes, "employeeName"), false)
  },
)

test(
  "concurrent payroll generation, run creation, and calculation preserve unique revisions",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await actor(prisma, "phase3-concurrent-admin", Role.ADMIN)
    await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Concurrency fixture",
      },
    })

    const generationResponses = await Promise.all(
      Array.from({ length: 2 }, () =>
        fetch(`${base}/payroll/periods`, {
          method: "POST",
          headers: { ...admin.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ year: 2026 }),
        }),
      ),
    )
    assert.deepEqual(
      generationResponses.map(({ status }) => status),
      [201, 201],
    )
    const generations = await Promise.all(
      generationResponses.map((response) => response.json()) as Promise<{
        createdCount: number
        rows: { id: string; startDate: string }[]
      }>[],
    )
    assert.equal(
      generations.reduce((total, result) => total + result.createdCount, 0),
      12,
    )
    assert.equal(await prisma.payrollPeriod.count(), 12)
    const november = generations
      .flatMap(({ rows }) => rows)
      .find(({ startDate }) => startDate === "2026-11-01")
    assert.ok(november)

    const runResponses = await Promise.all(
      Array.from({ length: 2 }, () =>
        fetch(`${base}/payroll/runs`, {
          method: "POST",
          headers: { ...admin.headers, "Content-Type": "application/json" },
          body: JSON.stringify({ periodId: november.id }),
        }),
      ),
    )
    assert.deepEqual(
      runResponses.map(({ status }) => status).sort(),
      [201, 409],
    )
    const run = (await runResponses
      .find((response) => response.status === 201)!
      .json()) as { id: string }
    assert.equal(
      await prisma.payrollRun.count({ where: { periodId: november.id } }),
      1,
    )

    const employee = await prisma.employee.create({
      data: {
        employeeId: "PHASE3-CONCURRENT-EMP",
        fullName: "Payroll Concurrency Employee",
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: new Date("2025-01-01T00:00:00.000Z"),
      },
    })
    await prisma.employeeCompensation.create({
      data: {
        employeeId: employee.id,
        payType: "MONTHLY",
        baseRate: "18000.00",
        currency: "PHP",
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdById: admin.user.id,
        changeReason: "Concurrency calculation fixture",
      },
    })

    const calculationResponses = await Promise.all(
      Array.from({ length: 2 }, () =>
        fetch(`${base}/payroll/runs/${run.id}/calculate`, {
          method: "POST",
          headers: admin.headers,
        }),
      ),
    )
    assert.deepEqual(
      calculationResponses.map(({ status }) => status).sort(),
      [200, 409],
    )
    const persistedRun = await prisma.payrollRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    assert.equal(persistedRun.calculationCount, 1)
    assert.equal(
      await prisma.payrollRunCalculation.count({ where: { runId: run.id } }),
      1,
    )
    assert.equal(
      await prisma.payrollRunItem.count({
        where: { calculation: { runId: run.id } },
      }),
      1,
    )
  },
)

async function actor(
  prisma: Awaited<ReturnType<typeof startPgliteApp>>["prisma"],
  key: string,
  role: Role,
  options: { active?: boolean; deleted?: boolean } = {},
) {
  const user = await prisma.user.create({
    data: {
      id: key,
      role,
      email: `${key}@payroll-phase3.test`,
      passwordHash: "not-a-real-password-hash",
      isActive: options.active ?? true,
      accountDeletedAt: options.deleted
        ? new Date("2026-11-15T00:00:00.000Z")
        : null,
    },
  })
  return {
    user,
    headers: {
      Authorization: `Bearer ${(await issueSession(user)).token}`,
    },
  }
}
