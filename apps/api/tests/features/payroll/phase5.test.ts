import { writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import {
  type readReconciliation,
  recordReconciliationExceptions,
} from "../../../src/features/payroll/payroll-reconciliation.service.js"
import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "Phase 5 serves immutable payslips and private requests only to authorized accounts",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function account(
      id: string,
      role: Role,
      active = true,
      deleted = false,
    ) {
      const user = await prisma.user.create({
        data: {
          id,
          role,
          email: id + "@payslip.test",
          passwordHash: "fixture",
          isActive: active,
          accountDeletedAt: deleted ? new Date() : null,
        },
      })
      return { id, token: (await issueSession(user)).token }
    }
    const admin = await account("document-admin", Role.ADMIN)
    const reviewer = await account("document-reviewer", Role.ADMIN)
    const superadmin = await account("document-superadmin", Role.SUPERADMIN)
    const staff = await account("document-staff", Role.STAFF)
    const other = await account("document-other", Role.STAFF)
    const unlinked = await account("document-unlinked", Role.STAFF)
    const inactive = await account("document-inactive", Role.STAFF, false)
    const deleted = await account("document-deleted", Role.STAFF, true, true)
    const client = await account("document-client", Role.USER)
    const employee = await prisma.employee.create({
      data: {
        userId: staff.id,
        employeeId: "PAY-001",
        fullName: "Morgan Payroll",
        employmentType: "FULL_TIME",
      },
    })
    await prisma.employee.create({
      data: {
        userId: other.id,
        employeeId: "PAY-002",
        fullName: "Other Staff",
        employmentType: "FULL_TIME",
      },
    })
    const startDate = new Date("2026-11-01T00:00:00.000Z")
    const configuration = await prisma.payrollConfiguration.create({
      data: {
        frequency: "MONTHLY",
        effectiveFrom: startDate,
        createdById: admin.id,
        changeReason: "Payslip fixture",
      },
    })
    const period = await prisma.payrollPeriod.create({
      data: {
        configurationId: configuration.id,
        createdById: admin.id,
        cutoffLabel: "November 2026",
        startDate,
        endDate: new Date("2026-11-30T00:00:00.000Z"),
      },
    })
    const run = await prisma.payrollRun.create({
      data: {
        status: "DRAFT",
        periodId: period.id,
        createdById: admin.id,
        calculationCount: 1,
      },
    })
    const revision = await prisma.payrollRunCalculation.create({
      data: {
        runId: run.id,
        revision: 1,
        status: "COMPLETE",
        createdById: admin.id,
        inputSnapshot: {},
        calculatedItemCount: 1,
        grossTotal: "12345.67",
        deductionsTotal: "45.67",
        netTotal: "12300.00",
        items: {
          create: {
            employeeId: employee.id,
            employeeNumberSnapshot: employee.employeeId,
            employeeNameSnapshot: employee.fullName,
            employmentTypeSnapshot: "FULL_TIME",
            status: "CALCULATED",
            grossAmount: "12345.67",
            deductionsAmount: "45.67",
            netAmount: "12300.00",
            compensationSnapshot: {},
            attendanceSnapshot: {},
            warnings: [],
            blocks: [],
            components: {
              create: [
                {
                  name: "Base earnings",
                  componentType: "BASE_EARNING",
                  status: "CALCULATED",
                  amount: "12345.67",
                  metadata: {},
                },
                {
                  name: "Recurring deduction",
                  componentType: "DEDUCTION",
                  status: "CALCULATED",
                  amount: "45.67",
                  metadata: {},
                },
              ],
            },
          },
        },
      },
    })
    function api(
      path: string,
      actor?: typeof admin,
      method = "GET",
      body?: object,
    ) {
      return fetch(base + path, {
        method,
        headers: {
          ...(actor ? { Authorization: "Bearer " + actor.token } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
    }
    const generate = "/payroll/runs/" + run.id + "/generate-payslips"
    const publish = "/payroll/runs/" + run.id + "/publish-payslips"
    const self = "/staff/my-payroll"
    const reports = "/payroll/reports"
    assert.equal((await api(reports, staff)).status, 403)
    assert.equal((await api(reports, client)).status, 403)
    assert.equal((await api(reports + "/export", superadmin)).status, 403)
    assert.equal(
      (await api(reports + "?through=2026-02-30", admin)).status,
      400,
    )
    const draftReport = await api(reports, superadmin)
    assert.equal(draftReport.status, 200)
    assert.equal(((await draftReport.json()) as { total: number }).total, 0)
    const overview = "/payroll/overview"
    assert.equal((await api(overview, staff)).status, 403)
    assert.equal((await api(overview, client)).status, 403)
    assert.equal((await api(overview + "?periods=50", admin)).status, 400)
    const draftOverview = (await (await api(overview, superadmin)).json()) as {
      approvedNet: string
      approvedRuns: number
    }
    assert.equal(draftOverview.approvedRuns, 0)
    assert.equal(draftOverview.approvedNet, "0.00")
    const readinessPath = "/payroll/settings/readiness"
    const auditPath = "/payroll/settings/audit"
    for (const actor of [staff, client]) {
      assert.equal((await api(readinessPath, actor)).status, 403)
      assert.equal((await api(auditPath, actor)).status, 403)
    }
    type Readiness = {
      capabilities: { id: string; state: string; reason: string }[]
    }
    const initialProbe = await api(readinessPath, superadmin)
    assert.equal(initialProbe.status, 200)
    const initialReadiness = (await initialProbe.json()) as Readiness
    assert.equal(
      initialReadiness.capabilities.find(({ id }) => id === "real-disbursement")
        ?.reason,
      "LIVE_EXECUTION_DISABLED",
    )
    assert.equal(
      initialReadiness.capabilities.find(({ id }) => id === "publication")
        ?.state,
      "READY",
    )
    assert.equal(
      initialReadiness.capabilities.find(({ id }) => id === "reconciliation")
        ?.state,
      "READY",
    )
    assert.equal((await api(auditPath + "?page=0", admin)).status, 400)
    const scheduleWithStaleSource = await api(
      "/payroll/settings/versions",
      admin,
      "POST",
      {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: "2027-01-01",
        expectedLatestId: null,
        changeReason: "Stale schedule form",
      },
    )
    assert.equal(scheduleWithStaleSource.status, 409)
    assert.equal(await prisma.payrollConfiguration.count(), 1)
    const reconciliation = "/payroll/runs/" + run.id + "/reconciliation"
    assert.equal((await api(reconciliation, admin)).status, 409)
    assert.equal((await api(reconciliation, staff)).status, 403)
    assert.equal((await api(reconciliation, client)).status, 403)
    assert.equal((await api(generate, admin, "POST")).status, 409)
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "REJECTED" },
    })
    assert.equal((await api(generate, admin, "POST")).status, 409)
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: "CALCULATED" },
    })
    assert.equal(
      (
        await api("/payroll/runs/" + run.id + "/submit", admin, "POST", {
          calculationId: revision.id,
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await api("/payroll/runs/" + run.id + "/approve", reviewer, "POST", {
          calculationId: revision.id,
        })
      ).status,
      200,
    )
    assert.equal((await api(publish, admin, "POST")).status, 409)
    assert.equal((await api(generate, superadmin, "POST")).status, 403)
    const beforeGeneration =
      await prisma.payrollRunCalculation.findUniqueOrThrow({
        where: { id: revision.id },
        include: { items: { include: { components: true } } },
      })
    const auditBeforeGeneration = await prisma.workforceManagementChange.count()
    await prisma.$executeRaw`
      ALTER TABLE "PayrollPayslip"
      ADD CONSTRAINT payroll_generation_test_failure CHECK (false)
    `
    try {
      assert.equal((await api(generate, admin, "POST")).status, 500)
      assert.equal(await prisma.payrollPayslip.count(), 0)
      assert.equal(
        await prisma.workforceManagementChange.count(),
        auditBeforeGeneration,
      )
      assert.deepEqual(
        await prisma.payrollRunCalculation.findUniqueOrThrow({
          where: { id: revision.id },
          include: { items: { include: { components: true } } },
        }),
        beforeGeneration,
      )
    } finally {
      await prisma.$executeRaw`ALTER TABLE "PayrollPayslip" DROP CONSTRAINT payroll_generation_test_failure`
    }
    const generationRace = await Promise.all([
      api(generate, admin, "POST"),
      api(generate, admin, "POST"),
    ])
    for (const response of generationRace) assert.equal(response.status, 200)
    const generationResults = await Promise.all(
      generationRace.map(
        (response) =>
          response.json() as Promise<{ total: number; changed: number }>,
      ),
    )
    assert.deepEqual(
      generationResults.map(({ changed }) => changed).sort(),
      [0, 1],
    )
    assert.ok(generationResults.every(({ total }) => total === 1))
    assert.equal(await prisma.payrollPayslip.count(), 1)
    assert.deepEqual(await (await api(generate, admin, "POST")).json(), {
      total: 1,
      changed: 0,
    })
    const document = await prisma.payrollPayslip.findFirstOrThrow()
    const detail = self + "/payslips/" + document.id
    assert.equal((await api(detail + "/preview", staff)).status, 404)
    const draftPreview = await api(
      "/payroll/payslips/" + document.id + "/preview",
      admin,
    )
    assert.equal(draftPreview.status, 200)
    assert.match(draftPreview.headers.get("content-type")!, /application\/pdf/)
    const draftPdf = await draftPreview.text()
    assert.match(draftPdf, /Employee ID: PAY-001/)
    assert.match(draftPdf, /\/Logo Do/)
    const preferencesPath = "/payroll/settings/preferences"
    const defaults = {
      revision: 0,
      showCompanyLogo: true,
      showEmployeeId: true,
      requirePublicationConfirmation: true,
      requireSimulationConfirmation: false,
    }
    assert.deepEqual(
      await (await api(preferencesPath, superadmin)).json(),
      defaults,
    )
    assert.equal((await api(preferencesPath, staff)).status, 403)
    assert.equal((await api(preferencesPath, client)).status, 403)
    assert.equal(
      (await api(preferencesPath, superadmin, "PUT", defaults)).status,
      403,
    )
    assert.equal(
      (
        await api(preferencesPath, admin, "PUT", {
          ...defaults,
          showEmployeeId: "false",
        })
      ).status,
      400,
    )
    const next = {
      ...defaults,
      showCompanyLogo: false,
      showEmployeeId: false,
      requirePublicationConfirmation: false,
      requireSimulationConfirmation: true,
    }
    const concurrent = await Promise.all([
      api(preferencesPath, admin, "PUT", next),
      api(preferencesPath, admin, "PUT", next),
    ])
    assert.deepEqual(concurrent.map(({ status }) => status).sort(), [200, 409])
    assert.deepEqual(await (await api(preferencesPath, admin)).json(), {
      ...next,
      revision: 1,
    })
    const preferenceAudit =
      await prisma.workforceManagementChange.findFirstOrThrow({
        where: { action: "PAYROLL_PREFERENCES_UPDATED" },
      })
    assert.equal(preferenceAudit.actorAccountId, admin.id)
    const regenerated = await api(
      "/payroll/payslips/" + document.id + "/regenerate",
      admin,
      "POST",
    )
    assert.equal(regenerated.status, 200)
    const refreshedDocument = await prisma.payrollPayslip.findUniqueOrThrow({
      where: { id: document.id },
    })
    assert.equal(refreshedDocument.reference, document.reference)
    assert.equal(refreshedDocument.itemId, document.itemId)
    assert.equal(refreshedDocument.publishedAt, null)
    assert.doesNotMatch(
      Buffer.from(refreshedDocument.document).toString(),
      /\/Logo Do/,
    )
    assert.doesNotMatch(
      Buffer.from(refreshedDocument.document).toString(),
      /Employee ID: PAY-001/,
    )
    assert.match(
      Buffer.from(refreshedDocument.document).toString(),
      /TOTAL NET PAYABLE/,
    )
    const generatedRun = (await api("/payroll/runs/" + run.id, admin).then(
      (response) => response.json(),
    )) as { latestCalculation: { payslipStatus: string } }
    assert.equal(generatedRun.latestCalculation.payslipStatus, "GENERATED")
    assert.equal((await api(detail, staff)).status, 404)
    const unpublishedResponse = await api(self + "/payslips", staff)
    const unpublishedPayslips = (await unpublishedResponse.json()) as {
      rows: { id: string }[]
    }
    assert.deepEqual(unpublishedPayslips.rows, [])
    assert.equal(
      (
        await api(self + "/requests", staff, "POST", {
          type: "PAYSLIP_CORRECTION",
          payslipId: document.id,
          description: "Please review this draft payslip.",
        })
      ).status,
      404,
    )
    assert.equal((await api(publish, superadmin, "POST")).status, 403)
    assert.equal(
      (await api("/payroll/payslips/" + document.id, superadmin)).status,
      200,
    )
    assert.deepEqual(await (await api(publish, admin, "POST")).json(), {
      total: 1,
      changed: 1,
    })
    const publishedRun = (await api("/payroll/runs/" + run.id, admin).then(
      (response) => response.json(),
    )) as { latestCalculation: { payslipStatus: string } }
    assert.equal(publishedRun.latestCalculation.payslipStatus, "PUBLISHED")
    await assert.rejects(
      prisma.$transaction((tx) =>
        tx.payrollPayslip.update({
          where: { id: document.id },
          data: { document: Uint8Array.from([0]) },
        }),
      ),
      /Payslip documents are immutable/,
    )
    assert.equal(
      (
        await api(
          "/payroll/payslips/" + document.id + "/regenerate",
          admin,
          "POST",
        )
      ).status,
      409,
    )
    assert.deepEqual(await (await api(publish, admin, "POST")).json(), {
      total: 1,
      changed: 0,
    })
    const slip = await api(detail, staff)
    assert.equal(slip.status, 200)
    assert.equal(((await slip.json()) as { net: string }).net, "12300.00")
    const ownPayslipList = await api(self + "/payslips", staff)
    assert.deepEqual(
      ((await ownPayslipList.json()) as { rows: { id: string }[] }).rows.map(
        (row) => row.id,
      ),
      [document.id],
    )
    const otherPayslipList = await api(self + "/payslips", other)
    assert.deepEqual(
      ((await otherPayslipList.json()) as { rows: { id: string }[] }).rows,
      [],
    )
    const initialOverview = await api(self, staff)
    assert.equal(initialOverview.status, 200)
    const initialSummary = (await initialOverview.json()) as {
      linked: boolean
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(initialSummary.linked, true)
    assert.equal(initialSummary.latestPayslip?.net, "12300.00")
    assert.equal(initialSummary.openConcernCount, 0)

    const unprepared = await api(reconciliation, superadmin)
    assert.equal(unprepared.status, 200)
    assert.equal(
      ((await unprepared.json()) as { status: string }).status,
      "NOT_STARTED",
    )
    assert.equal((await api(reconciliation + "?page=0", admin)).status, 400)
    const batches = "/payroll/disbursements"
    const prepare = () => api(batches, admin, "POST", { runId: run.id })
    const [firstBatch, repeatedBatch] = await Promise.all([
      prepare(),
      prepare(),
    ])
    assert.equal(firstBatch.status, 200)
    assert.equal(repeatedBatch.status, 200)
    const batch = (await firstBatch.json()) as {
      id: string
      frequency: string
      totalNet: string
      proposedAmount: string
    }
    assert.equal(((await repeatedBatch.json()) as { id: string }).id, batch.id)
    assert.equal(batch.totalNet, "12300.00")
    assert.equal(batch.proposedAmount, "0.00")
    assert.equal(batch.frequency, "MONTHLY")
    const batchPath = batches + "/" + batch.id
    assert.equal((await api(batchPath, superadmin)).status, 200)
    assert.equal((await api(batchPath, staff)).status, 403)
    assert.equal(
      (await api(batchPath + "/validate", superadmin, "POST")).status,
      403,
    )
    const batchDetails = (await (await api(batchPath, admin)).json()) as {
      items: { id: string; amount: string }[]
      itemsPage: { page: number; pageSize: number; total: number }
    }
    const item = batchDetails.items[0]!
    assert.equal(item.amount, "12300.00")
    assert.equal(batchDetails.itemsPage.page, 1)
    assert.equal(batchDetails.itemsPage.pageSize, 10)
    assert.equal(batchDetails.itemsPage.total, 1)
    const pagedBatch = await api(
      batchPath + "?page=1&pageSize=20&sort=NET_DESC",
      admin,
    )
    assert.equal(pagedBatch.status, 200)
    assert.equal(
      (
        (await pagedBatch.json()) as {
          itemsPage: { pageSize: number; sort: string }
        }
      ).itemsPage.pageSize,
      20,
    )
    const destinationPath = batchPath + "/items/" + item.id + "/destination"
    const simulatePath = batchPath + "/items/" + item.id + "/simulate"
    assert.equal(
      (await api(destinationPath, admin, "POST", { kind: "TEST_BANK" })).status,
      403,
    )
    const oldNodeEnv = process.env.NODE_ENV
    const oldSimulator = process.env.PAYROLL_LOCAL_SIMULATOR
    process.env.NODE_ENV = "development"
    process.env.PAYROLL_LOCAL_SIMULATOR = "true"
    try {
      const enabledProbe = await api(readinessPath, admin)
      assert.equal(enabledProbe.status, 200)
      const ready = (await enabledProbe.json()) as Readiness
      assert.equal(
        ready.capabilities.find(({ id }) => id === "simulation")?.state,
        "READY",
      )
      assert.equal(
        ready.capabilities.find(({ id }) => id === "real-disbursement")?.state,
        "UNAVAILABLE",
      )
      const key = "55ac1828-e12c-47a5-8e13-9ab05cf67132"
      const simulation = { outcome: "FAILED", idempotencyKey: key }
      assert.equal(
        (await api(simulatePath, admin, "POST", simulation)).status,
        409,
      )
      assert.equal(
        (await api(destinationPath, superadmin, "POST", { kind: "TEST_BANK" }))
          .status,
        403,
      )
      const destination = await api(destinationPath, admin, "POST", {
        kind: "TEST_BANK",
      })
      assert.equal(destination.status, 200)
      const configured = (await destination.json()) as {
        items: {
          id: string
          status: string
          destination: { masked: string } | null
        }[]
      }
      assert.equal(configured.items[0]?.status, "BLOCKED")
      assert.equal(
        (
          (await (await api(reconciliation, admin)).json()) as {
            status: string
          }
        ).status,
        "PENDING",
      )
      assert.match(configured.items[0]?.destination?.masked ?? "", /•••• \d{4}/)
      const replay = await Promise.all([
        api(simulatePath, admin, "POST", simulation),
        api(simulatePath, admin, "POST", simulation),
      ])
      assert.deepEqual(
        replay.map((response) => response.status),
        [200, 200],
      )
      const evaluated = (await (
        await api(reconciliation, superadmin)
      ).json()) as Awaited<ReturnType<typeof readReconciliation>>
      assert.equal(evaluated.status, "EXCEPTION")
      assert.equal(evaluated.amounts.realPaid, "0.00")
      assert.equal(evaluated.amounts.failed, "12300.00")
      assert.equal(evaluated.exceptions.rows[0]?.category, "FAILED_PAYOUT")
      assert.equal(await prisma.payrollReconciliationException.count(), 0)
      assert.deepEqual(
        await Promise.all([
          recordReconciliationExceptions(run.id),
          recordReconciliationExceptions(run.id),
        ]),
        [1, 1],
      )
      assert.equal(await prisma.payrollReconciliationException.count(), 1)
      const observationPath = reconciliation + "/observations"
      assert.equal((await api(observationPath, superadmin, "POST")).status, 403)
      assert.equal((await api(observationPath, admin, "POST")).status, 200)
      const stored =
        await prisma.payrollReconciliationException.findFirstOrThrow()
      await prisma.payrollReconciliationException.create({
        data: {
          calculationId: stored.calculationId,
          subjectId: stored.subjectId,
          firstDetectedAt: stored.firstDetectedAt,
          lastObservedAt: stored.lastObservedAt,
          firstEvidence: { category: "MISSING_PAYOUT_RECORD" },
          category: "MISSING_PAYOUT_RECORD",
          lastEvidence: {
            ...evaluated.exceptions.rows[0],
            category: "MISSING_PAYOUT_RECORD",
            observed: null,
          },
        },
      })
      const decisionPath = reconciliation + "/decisions"
      const decision = {
        subjectId: stored.subjectId,
        category: stored.category,
        version: stored.version,
        action: "START_REVIEW",
        reason: "Check the failed simulation",
        requestId: randomUUID(),
      }
      assert.equal(
        (await api(decisionPath, superadmin, "POST", decision)).status,
        403,
      )
      assert.equal(
        (await api(decisionPath, staff, "POST", decision)).status,
        403,
      )
      assert.equal(
        (await api(decisionPath, client, "POST", decision)).status,
        403,
      )
      assert.equal(
        (
          await api(decisionPath, reviewer, "POST", {
            ...decision,
            reason: "  ",
          })
        ).status,
        400,
      )
      const duplicate = await Promise.all([
        api(decisionPath, reviewer, "POST", decision),
        api(decisionPath, reviewer, "POST", decision),
      ])
      assert.deepEqual(
        duplicate.map((response) => response.status),
        [200, 200],
      )
      assert.deepEqual(await duplicate[0]!.json(), await duplicate[1]!.json())
      const resolve = {
        ...decision,
        requestId: randomUUID(),
        action: "RESOLVE",
        version: stored.version + 1,
        classification: "FURTHER_ACTION_REQUIRED",
        reason: "Investigation complete; payout still failed",
      }
      assert.equal(
        (await api(decisionPath, admin, "POST", resolve)).status,
        403,
      )
      assert.equal(
        (
          await api(decisionPath, reviewer, "POST", {
            ...resolve,
            version: stored.version,
          })
        ).status,
        409,
      )
      assert.equal(
        (await api(decisionPath, reviewer, "POST", resolve)).status,
        200,
      )
      const afterResolution = (await (
        await api(reconciliation, superadmin)
      ).json()) as Awaited<ReturnType<typeof readReconciliation>>
      const dashboardResponse = await api(overview + "?periods=3", admin)
      assert.equal(dashboardResponse.status, 200)
      const dashboard = (await dashboardResponse.json()) as {
        approvedNet: string
        realConfirmedPaid: string
        approvedRuns: number
        currentExceptions: number
        payoutCounts: Record<string, number>
      }
      assert.equal(dashboard.approvedNet, "12300.00")
      assert.equal(dashboard.approvedRuns, 1)
      assert.equal(dashboard.realConfirmedPaid, "0.00")
      assert.equal(dashboard.currentExceptions, 1)
      assert.equal(dashboard.payoutCounts.FAILED, 1)
      assert.equal(
        await prisma.payrollReconciliationDecision.count({
          where: { calculationId: revision.id },
        }),
        2,
      )
      assert.equal(afterResolution.amounts.failed, "12300.00")
      assert.equal(afterResolution.amounts.realPaid, "0.00")
      assert.equal(afterResolution.exceptions.rows[0]?.lifecycle, "RESOLVED")
      assert.equal(afterResolution.exceptions.rows[0]?.observation, "CURRENT")
      const reopen = {
        ...decision,
        action: "REOPEN",
        version: stored.version + 2,
        requestId: randomUUID(),
        reason: "Review newly received operational information",
      }
      assert.equal(
        (await api(decisionPath, reviewer, "POST", reopen)).status,
        200,
      )
      const decisionHistory = await api(
        reconciliation +
          "/exceptions/" +
          stored.category +
          "/" +
          stored.subjectId +
          "/decisions",
        superadmin,
      )
      assert.equal(decisionHistory.status, 200)
      assert.deepEqual(
        (
          (await decisionHistory.json()) as { decisions: { action: string }[] }
        ).decisions.map((event) => event.action),
        ["START_REVIEW", "RESOLVE", "REOPEN"],
      )
      const assessment = {
        ...decision,
        action: "ASSESS",
        version: stored.version + 3,
        requestId: randomUUID(),
        assessment: "MANUAL_VERIFICATION",
        reason: "Confirm the payout separately before taking financial action",
      }
      assert.equal(
        (await api(decisionPath, reviewer, "POST", assessment)).status,
        200,
      )
      const dismissal = {
        ...decision,
        action: "DISMISS",
        version: stored.version + 4,
        requestId: randomUUID(),
        classification: "EXPECTED_CONDITION",
        reason: "Expected failed outcome in this simulator exercise",
      }
      assert.equal(
        (
          await api(decisionPath, reviewer, "POST", {
            ...dismissal,
            reason: "",
          })
        ).status,
        400,
      )
      assert.equal(
        (await api(decisionPath, reviewer, "POST", dismissal)).status,
        200,
      )
      assert.equal(
        (
          await api(decisionPath, reviewer, "POST", {
            ...dismissal,
            version: stored.version + 5,
            requestId: randomUUID(),
          })
        ).status,
        409,
      )

      // Model a previous evaluation that recorded the discrepancy as absent.
      const exceptionKey = {
        calculationId: stored.calculationId,
        category: stored.category,
        subjectId: stored.subjectId,
      }
      await prisma.payrollReconciliationException.update({
        where: { calculationId_category_subjectId: exceptionKey },
        data: { observed: false, version: { increment: 1 } },
      })
      const recurred = (await (
        await api(reconciliation, reviewer)
      ).json()) as Awaited<ReturnType<typeof readReconciliation>>
      assert.equal(recurred.exceptions.rows[0]?.recurring, true)
      assert.equal(recurred.exceptions.rows[0]?.version, null)
      assert.equal((await api(observationPath, reviewer, "POST")).status, 200)
      const reopenedCycle =
        await prisma.payrollReconciliationException.findUniqueOrThrow({
          where: { calculationId_category_subjectId: exceptionKey },
        })
      assert.equal(reopenedCycle.status, "OPEN")
      assert.deepEqual(reopenedCycle.firstEvidence, stored.firstEvidence)
      assert.equal(
        await prisma.payrollReconciliationDecision.count({
          where: exceptionKey,
        }),
        5,
      )
      const reportSummary = await api(reports + "?category=summary", superadmin)
      assert.equal(reportSummary.status, 200)
      type ReportFixture = { rows: { cells: string[] }[]; total: number }
      assert.deepEqual(
        ((await reportSummary.json()) as ReportFixture).rows[0]?.cells.slice(2),
        ["1", "12345.67", "45.67", "12300.00"],
      )
      const reportComponents = await api(
        reports + "?category=compensation",
        admin,
      )
      assert.equal(reportComponents.status, 200)
      assert.equal(
        ((await reportComponents.json()) as ReportFixture).rows[0]?.cells[2],
        "12345.67",
      )
      const payoutReport = await api(
        reports + "?category=disbursements&status=FAILED",
        admin,
      )
      assert.equal(payoutReport.status, 200)
      assert.deepEqual(
        ((await payoutReport.json()) as ReportFixture).rows[0]?.cells.slice(
          2,
          5,
        ),
        ["12300.00", "Failed", "None"],
      )
      const exceptionReport = await api(
        reports + "?category=reconciliation&status=HISTORICAL",
        superadmin,
      )
      assert.equal(exceptionReport.status, 200)
      assert.equal(
        ((await exceptionReport.json()) as ReportFixture).rows[0]?.cells[3],
        "Historical",
      )
      assert.equal(
        await prisma.payrollReconciliationDecision.count({
          where: { calculationId: revision.id },
        }),
        5,
      )
      const csv = await api(
        reports + "/export?category=summary&page=99&search=november",
        admin,
      )
      assert.equal(csv.status, 200)
      assert.match(csv.headers.get("content-type")!, /text\/csv/)
      assert.match(
        await csv.text(),
        /"November 2026","1","1","12345\.67","45\.67","12300\.00"/,
      )
      const auditCount = await prisma.workforceManagementChange.count()
      const auditResponse = await api(
        auditPath + "?subject=PAYROLL_RUN",
        superadmin,
      )
      assert.equal(auditResponse.status, 200)
      const auditPage = (await auditResponse.json()) as {
        rows: { activity: string; subjectType: string; changes?: unknown }[]
        total: number
      }
      assert.ok(
        auditPage.rows.some(
          ({ activity }) => activity === "RECONCILIATION_DECIDED",
        ),
      )
      assert.ok(
        auditPage.rows.every(
          (event) =>
            event.subjectType === "PAYROLL_RUN" &&
            !Object.hasOwn(event, "changes"),
        ),
      )
      assert.equal(await prisma.workforceManagementChange.count(), auditCount)
      const exportQuery = "?category=summary&search=november&format="
      const detailed = await api(
        reports + "/export" + exportQuery + "csv",
        admin,
      )
      assert.equal(detailed.status, 200)
      const detailedCsv = await detailed.text()
      assert.match(
        detailedCsv,
        /"Employee name","Base compensation","Allowances","Gross pay"/,
      )
      assert.match(
        detailedCsv,
        /"12345\.67","","12345\.67","Recurring deduction: 45\.67","45\.67","12300\.00"/,
      )
      const workbook = await api(
        reports + "/export" + exportQuery + "xlsx",
        admin,
      )
      assert.equal(workbook.status, 200)
      assert.equal(
        workbook.headers.get("content-type"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      assert.match(
        workbook.headers.get("content-disposition")!,
        /converyn-payroll-summary-2026-11-01-to-2026-11-30\.xlsx/,
      )
      const workbookBytes = Buffer.from(await workbook.arrayBuffer())
      assert.equal(workbookBytes.readUInt32LE(0), 0x04034b50)
      if (process.env.NEXUS_PAYROLL_WORKBOOK_CAPTURE)
        await writeFile(
          process.env.NEXUS_PAYROLL_WORKBOOK_CAPTURE,
          workbookBytes,
        )
      assert.equal(
        (await api(reports + "/export" + exportQuery + "xlsx", superadmin))
          .status,
        403,
      )
      assert.equal(
        (await api(reports + "/export" + exportQuery + "invalid", admin))
          .status,
        400,
      )
      for (const [category, filter, expected] of [
        ["compensation", "", /Recurring deduction: 45\.67/],
        ["disbursements", "&status=FAILED", /"Failed","None"/],
        ["reconciliation", "&status=HISTORICAL", /"Historical"/],
      ] as const) {
        const exported = await api(
          reports + "/export?format=csv&category=" + category + filter,
          admin,
        )
        assert.equal(exported.status, 200)
        assert.match(await exported.text(), expected)
      }
      const history = await api(
        reconciliation + "?observation=HISTORICAL",
        admin,
      )
      assert.equal(history.status, 200)
      const historyData = (await history.json()) as Awaited<
        ReturnType<typeof readReconciliation>
      >
      assert.equal(historyData.exceptions.total, 1)
      assert.equal(historyData.exceptions.rows[0]?.observation, "HISTORICAL")
      assert.equal(
        historyData.exceptions.rows[0]?.category,
        "MISSING_PAYOUT_RECORD",
      )
      assert.equal(await prisma.payrollReconciliationException.count(), 2)
      const filtered = await api(
        reconciliation + "?search=unknown-employee",
        admin,
      )
      assert.equal(filtered.status, 200)
      const filteredData = (await filtered.json()) as Awaited<
        ReturnType<typeof readReconciliation>
      >
      assert.equal(filteredData.employees.total, 0)
      assert.equal(filteredData.amounts.approved, "12300.00")
      assert.equal(
        await prisma.payrollTransferAttempt.count({
          where: { itemId: item.id },
        }),
        1,
      )
      assert.equal(
        (
          await prisma.payrollTransferAttempt.findUniqueOrThrow({
            where: { itemId: item.id },
          })
        ).outcome,
        "FAILED",
      )
      assert.equal(
        (
          await api(simulatePath, admin, "POST", {
            ...simulation,
            outcome: "PENDING",
          })
        ).status,
        409,
      )
      assert.equal(
        (
          await api(simulatePath, admin, "POST", {
            outcome: "SUCCEEDED",
            idempotencyKey: "cb5ee10e-bdfc-4530-87be-db51b7a6bda8",
          })
        ).status,
        409,
      )
    } finally {
      if (oldNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = oldNodeEnv
      if (oldSimulator === undefined) delete process.env.PAYROLL_LOCAL_SIMULATOR
      else process.env.PAYROLL_LOCAL_SIMULATOR = oldSimulator
    }
    const validation = await api(batchPath + "/validate", admin, "POST")
    assert.equal(validation.status, 200)
    assert.equal(
      ((await validation.json()) as { status: string }).status,
      "BLOCKED",
    )
    assert.equal((await api(batchPath + "/cancel", admin, "POST")).status, 200)
    assert.equal(
      (await api(batchPath + "/validate", admin, "POST")).status,
      409,
    )
    const pdf = await api(detail + "/download", staff)
    assert.equal(pdf.status, 200)
    assert.match(pdf.headers.get("cache-control")!, /no-store/)
    assert.match(pdf.headers.get("content-type")!, /application\/pdf/)
    const pdfContents = await pdf.text()
    assert.match(pdfContents, /^%PDF-/)
    assert.match(pdfContents, /TOTAL NET PAYABLE/)
    assert.match(pdfContents, /\(12,300\.00\) Tj/)
    assert.match(pdfContents, /\(45\.67\) Tj/)
    for (const actor of [other, unlinked]) {
      assert.equal((await api(detail, actor)).status, 404)
      assert.equal((await api(detail + "/download", actor)).status, 404)
    }
    for (const actor of [inactive, deleted, undefined])
      assert.equal((await api(detail, actor)).status, 401)
    assert.equal((await api(detail, client)).status, 403)
    assert.equal((await api("/payroll/payslips", staff)).status, 403)
    await assert.rejects(
      prisma.$transaction((tx) =>
        tx.payrollPayslip.update({
          where: { id: document.id },
          data: { document: Buffer.from("changed") },
        }),
      ),
    )

    const requestBody = {
      type: "PAYSLIP_CORRECTION",
      payslipId: document.id,
      description: "Please review my payslip.",
    }
    const beforeInvalidRequests = await prisma.payrollEmployeeRequest.count()
    for (const payslipId of ["", "invalid/reference", "x".repeat(81)]) {
      const response = await api(self + "/requests", staff, "POST", {
        ...requestBody,
        payslipId,
      })
      const payload = await response.text()
      assert.equal(response.status, 400, payload)
      assert.deepEqual(JSON.parse(payload), {
        error: "Invalid payslip reference",
      })
    }
    for (let round = 0; round < 3; round++) {
      const invalidRequests = await Promise.all(
        Array.from({ length: 4 }, () =>
          api(self + "/requests", staff, "POST", {
            ...requestBody,
            payslipId: "invalid/reference",
          }),
        ),
      )
      for (const response of invalidRequests) {
        const payload = await response.text()
        assert.equal(response.status, 400, payload)
        assert.deepEqual(JSON.parse(payload), {
          error: "Invalid payslip reference",
        })
      }
    }
    const missingPayslipId = randomUUID()
    const missingPayslipReads = await Promise.all(
      Array.from({ length: 4 }, () =>
        api(self + "/payslips/" + missingPayslipId, staff),
      ),
    )
    for (const response of missingPayslipReads) {
      const payload = await response.text()
      assert.equal(response.status, 404, payload)
      assert.deepEqual(JSON.parse(payload), { error: "Payslip not found" })
    }
    const missingPayslipRequest = await api(self + "/requests", staff, "POST", {
      ...requestBody,
      payslipId: missingPayslipId,
    })
    assert.equal(missingPayslipRequest.status, 404)
    assert.deepEqual(await missingPayslipRequest.json(), {
      error: "Payslip not found",
    })
    const oversizedPath = await api(self + "/payslips/" + "x".repeat(81), staff)
    assert.equal(oversizedPath.status, 400)
    assert.deepEqual(await oversizedPath.json(), {
      error: "Invalid payroll reference",
    })
    assert.equal(
      (await api(self + "/requests", undefined, "POST", requestBody)).status,
      401,
    )
    assert.equal(
      (await api(self + "/requests", client, "POST", requestBody)).status,
      403,
    )
    assert.equal(
      await prisma.payrollEmployeeRequest.count(),
      beforeInvalidRequests,
    )
    assert.equal(
      (await api(self + "/requests", other, "POST", requestBody)).status,
      404,
    )
    assert.equal(
      (await api(self + "/requests", unlinked, "POST", requestBody)).status,
      403,
    )
    const created = await api(self + "/requests", staff, "POST", {
      ...requestBody,
      employeeId: "another-employee",
    })
    assert.equal(created.status, 201)
    const request = (await created.json()) as {
      id: string
      createdAt: string
      employee: { employeeId: string }
    }
    assert.equal(request.employee.employeeId, employee.employeeId)
    const staffRequest = self + "/requests/" + request.id
    const adminRequest = "/payroll/requests/" + request.id
    for (const actor of [other, unlinked]) {
      assert.equal(
        (
          await api(staffRequest, actor, "PATCH", {
            type: "PAYROLL_DISCREPANCY",
            payslipId: null,
            description: "Unauthorized edit attempt.",
          })
        ).status,
        actor === unlinked ? 403 : 404,
      )
      assert.equal(
        (await api(staffRequest, actor, "DELETE")).status,
        actor === unlinked ? 403 : 404,
      )
    }
    assert.equal(
      (
        await api(staffRequest, staff, "PATCH", {
          type: "PAYROLL_DISCREPANCY",
          payslipId: document.id,
          description: "  Please verify the revised earnings.  ",
        })
      ).status,
      200,
    )
    const editedResponse = await api(staffRequest, staff)
    const edited = (await editedResponse.json()) as {
      id: string
      type: string
      status: string
      createdAt: string
      updatedAt: string
      payslip: { id: string } | null
      messages: { body: string; isAdmin: boolean }[]
      activity: {
        changes: {
          activity?: string
          type?: { before: string; after: string }
          description?: { before: string; after: string }
        }
      }[]
    }
    assert.equal(edited.id, request.id)
    assert.equal(edited.type, "PAYROLL_DISCREPANCY")
    assert.equal(edited.status, "OPEN")
    assert.equal(edited.createdAt, request.createdAt)
    assert.ok(Date.parse(edited.updatedAt) >= Date.parse(edited.createdAt))
    assert.equal(edited.payslip?.id, document.id)
    assert.equal(
      edited.messages[0]?.body,
      "Please verify the revised earnings.",
    )
    assert.equal(edited.messages[0]?.isAdmin, false)
    assert.ok(
      edited.activity.some(
        (entry) =>
          entry.changes.activity === "REQUEST_EDITED" &&
          entry.changes.type?.before === "PAYSLIP_CORRECTION" &&
          entry.changes.type.after === "PAYROLL_DISCREPANCY" &&
          entry.changes.description?.after ===
            "Please verify the revised earnings.",
      ),
    )
    const searchedConcerns = await api(
      self +
        "/requests?search=verify%20the%20revised&status=OPEN&type=PAYROLL_DISCREPANCY",
      staff,
    )
    assert.deepEqual(
      (
        (await searchedConcerns.json()) as {
          rows: { id: string }[]
          total: number
        }
      ).rows.map((row) => row.id),
      [request.id],
    )
    const otherSearch = await api(
      self + "/requests?search=" + encodeURIComponent(request.id),
      other,
    )
    assert.equal(((await otherSearch.json()) as { total: number }).total, 0)
    const deletionCreated = await api(self + "/requests", staff, "POST", {
      type: "MISSING_SALARY_PAYMENT",
      description: "Please check my missing salary payment.",
    })
    assert.equal(deletionCreated.status, 201)
    const deletionRequest = (await deletionCreated.json()) as {
      id: string
      createdAt: string
    }
    const deletionPath = self + "/requests/" + deletionRequest.id
    assert.equal((await api(deletionPath, inactive, "DELETE")).status, 401)
    assert.equal((await api(deletionPath, undefined, "DELETE")).status, 401)
    assert.equal((await api(deletionPath, client, "DELETE")).status, 403)
    const withdrawnResponse = await api(deletionPath, staff, "DELETE")
    assert.equal(withdrawnResponse.status, 200)
    const withdrawn = (await withdrawnResponse.json()) as {
      id: string
      status: string
      createdAt: string
      withdrawnAt: string | null
      withdrawnBy: string | null
    }
    assert.equal(withdrawn.id, deletionRequest.id)
    assert.equal(withdrawn.status, "CLOSED")
    assert.equal(withdrawn.createdAt, deletionRequest.createdAt)
    assert.ok(withdrawn.withdrawnAt)
    assert.equal(withdrawn.withdrawnBy, staff.id)
    assert.equal((await api(deletionPath, staff)).status, 404)
    const retainedForAdmin = await api(
      "/payroll/requests/" + deletionRequest.id,
      admin,
    )
    assert.equal(retainedForAdmin.status, 200)
    const retainedRequest = (await retainedForAdmin.json()) as {
      withdrawnAt: string | null
      activity: { changes: { activity?: string } }[]
    }
    assert.ok(retainedRequest.withdrawnAt)
    assert.ok(
      retainedRequest.activity.some(
        (entry) => entry.changes.activity === "REQUEST_WITHDRAWN",
      ),
    )
    const activeConcerns = await api(self + "/requests", staff)
    assert.deepEqual(
      ((await activeConcerns.json()) as { rows: { id: string }[] }).rows.map(
        (row) => row.id,
      ),
      [request.id],
    )
    const raceCreated = await api(self + "/requests", staff, "POST", {
      type: "PAYROLL_DISCREPANCY",
      description: "Please review this concurrent concern.",
    })
    assert.equal(raceCreated.status, 201)
    const raceRequest = (await raceCreated.json()) as { id: string }
    const raceStaffPath = self + "/requests/" + raceRequest.id
    const raceAdminPath = "/payroll/requests/" + raceRequest.id
    const [raceReview, raceWithdrawal] = await Promise.all([
      api(raceAdminPath, admin, "PATCH", {
        status: "IN_REVIEW",
        message: "I am beginning this review.",
      }),
      api(raceStaffPath, staff, "DELETE"),
    ])
    assert.notEqual(raceReview.status === 200, raceWithdrawal.status === 200)
    const finalRaceRecord =
      await prisma.payrollEmployeeRequest.findUniqueOrThrow({
        where: { id: raceRequest.id },
      })
    if (raceWithdrawal.status === 200) {
      assert.equal(finalRaceRecord.status, "CLOSED")
      assert.ok(finalRaceRecord.withdrawnAt)
      assert.equal(raceReview.status, 409)
    } else {
      assert.equal(finalRaceRecord.status, "IN_REVIEW")
      assert.equal(finalRaceRecord.withdrawnAt, null)
      assert.equal(raceWithdrawal.status, 409)
    }
    const editRaceCreated = await api(self + "/requests", staff, "POST", {
      type: "PAYROLL_DISCREPANCY",
      description: "Please check this concurrent edit concern.",
    })
    assert.equal(editRaceCreated.status, 201)
    const editRaceRequest = (await editRaceCreated.json()) as { id: string }
    const editRaceStaffPath = self + "/requests/" + editRaceRequest.id
    const editRaceAdminPath = "/payroll/requests/" + editRaceRequest.id
    const [editRaceReview, editRaceStaff] = await Promise.all([
      api(editRaceAdminPath, admin, "PATCH", {
        status: "IN_REVIEW",
        message: "Reviewing this concern now.",
      }),
      api(editRaceStaffPath, staff, "PATCH", {
        type: "PAYROLL_DISCREPANCY",
        payslipId: null,
        description: "Updated during the review race.",
      }),
    ])
    assert.equal(editRaceReview.status, 200)
    assert.ok(editRaceStaff.status === 200 || editRaceStaff.status === 409)
    const editRaceFinal = await prisma.payrollEmployeeRequest.findUniqueOrThrow(
      {
        where: { id: editRaceRequest.id },
        include: { messages: { where: { isAdmin: false } } },
      },
    )
    assert.equal(editRaceFinal.status, "IN_REVIEW")
    assert.equal(
      editRaceFinal.messages[0]?.body,
      editRaceStaff.status === 200
        ? "Updated during the review race."
        : "Please check this concurrent edit concern.",
    )
    const overviewWithConcern = (await (await api(self, staff)).json()) as {
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(
      overviewWithConcern.openConcernCount,
      raceReview.status === 200 ? 3 : 2,
    )
    assert.equal(overviewWithConcern.latestPayslip?.net, "12300.00")
    assert.equal((await api(staffRequest, other)).status, 404)
    assert.equal(
      (
        await api(adminRequest, superadmin, "PATCH", {
          status: "IN_REVIEW",
          message: "Checking the details.",
        })
      ).status,
      403,
    )
    assert.equal(
      (
        await api(adminRequest, admin, "PATCH", {
          status: "RESOLVED",
          message: "Checking the details.",
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await api(adminRequest, admin, "PATCH", {
          status: "IN_REVIEW",
          message: "Checking the details.",
        })
      ).status,
      200,
    )
    assert.equal(
      (
        await api(staffRequest, staff, "PATCH", {
          type: "PAYSLIP_CORRECTION",
          description: "Too late to edit this concern.",
          payslipId: document.id,
        })
      ).status,
      409,
    )
    assert.equal((await api(staffRequest, staff, "DELETE")).status, 409)
    assert.equal(
      (
        await api(staffRequest + "/messages", staff, "POST", {
          message: "Thank you for checking.",
        })
      ).status,
      200,
    )
    const resolution = await api(adminRequest, admin, "PATCH", {
      status: "RESOLVED",
      message: "Correction requires a future approved adjustment.",
      needsFinancialCorrection: true,
    })
    assert.equal(resolution.status, 200)
    const resolved = (await resolution.json()) as {
      status: string
      needsFinancialCorrection: boolean
    }
    assert.equal(resolved.status, "RESOLVED")
    assert.equal(resolved.needsFinancialCorrection, true)
    const resolvedOverview = (await (await api(self, staff)).json()) as {
      openConcernCount: number
    }
    assert.equal(
      resolvedOverview.openConcernCount,
      raceReview.status === 200 ? 2 : 1,
    )
    const otherOverview = (await (await api(self, other)).json()) as {
      linked: boolean
      latestPayslip: { net: string } | null
      openConcernCount: number
    }
    assert.equal(otherOverview.linked, true)
    assert.equal(otherOverview.latestPayslip, null)
    assert.equal(otherOverview.openConcernCount, 0)
    await assert.rejects(
      prisma.$transaction((tx) =>
        tx.payrollRunItem.update({
          where: { id: document.itemId },
          data: { netAmount: "1.00" },
        }),
      ),
    )
    assert.equal(
      (
        await api(staffRequest + "/messages", staff, "POST", {
          message: "One more detail.",
        })
      ).status,
      409,
    )
    assert.equal(
      (
        await prisma.payrollRunCalculation.findUniqueOrThrow({
          where: { id: revision.id },
        })
      ).status,
      "COMPLETE",
    )
    assert.equal(
      await prisma.workforceManagementChange.count({
        where: { action: "PAYROLL_DOCUMENT_ACTIVITY" },
      }),
      26 + (editRaceStaff.status === 200 ? 1 : 0),
    )

    // PAY-API-001: self-service ownership follows the current employee link.
    await prisma.$transaction([
      prisma.employee.updateMany({
        where: { userId: other.id },
        data: { userId: null },
      }),
      prisma.employee.update({
        where: { id: employee.id },
        data: { userId: other.id },
      }),
    ])
    assert.equal((await api(detail, staff)).status, 404)
    const previousOwnerPayslips = await api(self + "/payslips", staff)
    assert.deepEqual(
      ((await previousOwnerPayslips.json()) as { rows: { id: string }[] }).rows,
      [],
    )
    const currentOwnerPayslip = await api(detail, other)
    assert.equal(currentOwnerPayslip.status, 200)
    assert.equal(
      ((await currentOwnerPayslip.json()) as { net: string }).net,
      "12300.00",
    )
  },
)
