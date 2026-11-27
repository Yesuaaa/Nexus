import { createApp } from "../../src/app.js"
import { getPrisma } from "../../src/lib/db.js"
import { authService } from "../../src/features/auth/auth.service.js"
import { verifyAccessToken } from "../../src/features/auth/auth.jwt.js"
import { payMongoDisbursements } from "../../src/features/payroll/paymongo-disbursements.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { showcaseId, showcaseUuid } from "./showcase-plan.js"

const reviewerEmail = "payroll.reviewer@showcase.invalid"
const fixtureEmails = [
  "demo.staff@example.test",
  "local-head@example.test",
  "advertising.head@local.test",
]
const dateKey = (date: Date) => date.toISOString().slice(0, 10)

export async function seedPayrollDashboard(
  password: string,
  enrichTrend = false,
) {
  const target = assertPhase2Target(process.env)
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.PAYROLL_LOCAL_SIMULATOR !== "true" ||
    payMongoDisbursements.enabled
  )
    throw new Error("Only the local payroll simulator is permitted")
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  const db = prisma
  await db.$transaction(async (tx) => {
    const [connected] = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`
    if (connected?.name !== target.database)
      throw new Error(
        "The connected database does not match the confirmed target",
      )
    await assertShowcaseRealtimeDisabled(tx)
  })
  const baseline = await db.employeeCompensation.findUniqueOrThrow({
    where: { id: showcaseId("compensation", 0) },
  })
  const anchor = new Date(baseline.effectiveFrom.getTime() + 365 * 86400000)
  const months = Array.from(
    { length: 6 },
    (_, index) =>
      new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 6 + index, 1),
      ),
  )
  const effective = dateKey(months[0])
  const fixtureStart = dateKey(
    new Date(
      Date.UTC(months[0].getUTCFullYear() - 1, months[0].getUTCMonth(), 1),
    ),
  )
  const server = createApp().listen(0, "127.0.0.1")
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  if (!address || typeof address === "string")
    throw new Error("Unable to start local application")
  const origin = `http://127.0.0.1:${address.port}`
  const sessions: string[] = []
  async function call(
    path: string,
    token: string | undefined,
    method = "GET",
    body?: unknown,
  ) {
    const response = await fetch(`${origin}/api${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const result = (await response.json().catch(() => null)) as {
      error?: string
      token: string
      id: string
    } | null
    if (!response.ok)
      throw new Error(
        `${method} ${path} failed (${response.status}): ${result?.error || "request failed"}`,
      )
    if (!result) throw new Error(`${method} ${path} returned no JSON`)
    return result
  }
  async function login(email: string) {
    const result = await call("/auth/login", undefined, "POST", {
      email,
      password,
    })
    const claims = await verifyAccessToken(result.token)
    sessions.push(claims.sessionId)
    return result.token as string
  }
  try {
    const admin = await login("operations@showcase.invalid")
    const superadmin = await login("oversight@showcase.invalid")
    let reviewer = await db.user.findUnique({
      where: { email: reviewerEmail },
      include: { employee: true },
    })
    if (!reviewer) {
      await call("/users", superadmin, "POST", {
        email: reviewerEmail,
        password,
        role: "ADMIN",
        fullName: "Showcase Payroll Reviewer",
      })
      reviewer = await db.user.findUniqueOrThrow({
        where: { email: reviewerEmail },
        include: { employee: true },
      })
    }
    if (
      reviewer.role !== "ADMIN" ||
      !reviewer.isActive ||
      reviewer.accountDeletedAt
    )
      throw new Error(
        "The payroll reviewer account is not an active administrator",
      )
    const approver = await login(reviewerEmail)
    const fixtureUsers = await db.user.findMany({
      where: { email: { in: fixtureEmails } },
      include: { employee: true },
    })
    if (
      target.database === "nexus_dev" &&
      fixtureUsers.length !== fixtureEmails.length
    )
      throw new Error("The expected three local test accounts were not found")
    const fixtureEmployees = [
      ...fixtureUsers.flatMap((user) => (user.employee ? [user.employee] : [])),
      ...(reviewer.employee ? [reviewer.employee] : []),
    ]
    for (const [index, employee] of fixtureEmployees.entries()) {
      if (employee.status !== "ACTIVE")
        throw new Error("A local test employee is not active")
      if (!employee.startDate)
        await call(`/employees/${employee.id}`, admin, "PUT", {
          startDate: fixtureStart,
        })
      else if (employee.startDate > months[0])
        throw new Error(
          "A local test employee starts after the first payroll period",
        )
      const existing = await db.employeeCompensation.findMany({
        where: { employeeId: employee.id },
      })
      if (!existing.length)
        await call(
          `/payroll/compensation/${employee.id}/versions`,
          admin,
          "POST",
          {
            payType: "MONTHLY",
            baseRate: (26000 + index * 3000).toFixed(2),
            currency: "PHP",
            effectiveFrom: fixtureStart,
            changeReason: "Fictional local showcase payroll",
            components: [],
          },
        )
      else if (
        existing.length !== 1 ||
        existing[0].changeReason !== "Fictional local showcase payroll" ||
        existing[0].effectiveFrom > months[0]
      )
        throw new Error(
          "A local employee has existing compensation; refusing to replace it",
        )
    }
    const known = new Set([
      ...fixtureEmployees.map((employee) => employee.id),
      ...Array.from({ length: 20 }, (_, index) =>
        showcaseId("employee", index),
      ),
    ])
    const employees = await db.employee.findMany({
      select: { id: true, status: true },
    })
    if (
      employees.some(
        (employee) => !known.has(employee.id) || employee.status !== "ACTIVE",
      )
    )
      throw new Error(
        "Unexpected employees require payroll review before seeding",
      )
    const configurations = await db.payrollConfiguration.findMany()
    if (!configurations.length)
      await call("/payroll/settings/versions", admin, "POST", {
        frequency: "MONTHLY",
        firstCutoffDay: null,
        currency: "PHP",
        effectiveFrom: effective,
        changeReason: "Fictional local showcase payroll schedule",
        expectedLatestId: null,
      })
    else if (
      configurations.length !== 1 ||
      configurations[0].frequency !== "MONTHLY" ||
      configurations[0].changeReason !==
        "Fictional local showcase payroll schedule" ||
      dateKey(configurations[0].effectiveFrom) !== effective
    )
      throw new Error(
        "Payroll schedule already exists and differs from the showcase plan",
      )
    for (const year of new Set(months.map((month) => month.getUTCFullYear())))
      await call("/payroll/periods", admin, "POST", { year })
    const summary = []
    for (let index = 0; index < months.length; index++) {
      if (enrichTrend && index >= 4) {
        for (let staffIndex = 0; staffIndex < 20; staffIndex++) {
          const employeeId = showcaseId("employee", staffIndex)
          const reason = `Fictional showcase trend revision ${index - 3}`
          const rate = (
            19000 +
            staffIndex * 2000 +
            ((staffIndex % 3) + 1) * 1200 * (index - 3)
          ).toFixed(2)
          const versions = await db.employeeCompensation.findMany({
            where: { employeeId },
            orderBy: { effectiveFrom: "desc" },
            include: { components: true },
          })
          const existing = versions.find(
            (version) =>
              version.effectiveFrom.getTime() === months[index].getTime(),
          )
          if (existing) {
            if (
              existing.changeReason !== reason ||
              existing.payType !== "MONTHLY" ||
              existing.baseRate.toFixed(2) !== rate ||
              existing.components.length !== 2
            )
              throw new Error(
                "A compensation revision conflicts with the showcase trend",
              )
          } else {
            if (!versions[0] || versions[0].effectiveFrom >= months[index])
              throw new Error("A later compensation revision already exists")
            await call(
              `/payroll/compensation/${employeeId}/versions`,
              admin,
              "POST",
              {
                payType: "MONTHLY",
                baseRate: rate,
                currency: "PHP",
                effectiveFrom: dateKey(months[index]),
                changeReason: reason,
                components: [
                  {
                    type: "ALLOWANCE",
                    name: "Communication allowance",
                    amount: (1000 + (staffIndex % 4) * 250).toFixed(2),
                  },
                  {
                    type: "RECURRING_DEDUCTION",
                    name: "Fictional employee contribution",
                    amount: (300 + (staffIndex % 3) * 100).toFixed(2),
                  },
                ],
              },
            )
          }
        }
      }
      const period = await db.payrollPeriod.findFirstOrThrow({
        where: { startDate: months[index] },
      })
      let run = await db.payrollRun.findUnique({
        where: { periodId: period.id },
      })
      if (!run) {
        const created = await call("/payroll/runs", admin, "POST", {
          periodId: period.id,
        })
        run = await db.payrollRun.findUniqueOrThrow({
          where: { id: created.id },
        })
      }
      if (run.createdById !== showcaseId("user", 1))
        throw new Error("A payroll run belongs to another preparer")
      if ((index < 4 || enrichTrend) && run.status === "DRAFT") {
        await call(`/payroll/runs/${run.id}/calculate`, admin, "POST")
        run = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
      }
      if ((index < 4 || enrichTrend) && run.status === "CALCULATED") {
        const revision = await db.payrollRunCalculation.findFirstOrThrow({
          where: { runId: run.id },
          orderBy: { revision: "desc" },
        })
        if (
          revision.status !== "COMPLETE" ||
          revision.blockedItemCount ||
          revision.reviewItemCount
        )
          throw new Error(
            `Payroll ${dateKey(months[index])} requires review before approval`,
          )
        await call(`/payroll/runs/${run.id}/submit`, admin, "POST", {
          calculationId: revision.id,
        })
        run = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
      }
      if (
        (index < 2 || (enrichTrend && index >= 4)) &&
        run.status === "PENDING_APPROVAL"
      ) {
        const revision = await db.payrollRunCalculation.findFirstOrThrow({
          where: { runId: run.id },
          orderBy: { revision: "desc" },
        })
        await call(`/payroll/runs/${run.id}/approve`, approver, "POST", {
          calculationId: revision.id,
        })
        run = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
      }
      if (index === 3 && run.status === "PENDING_APPROVAL") {
        const revision = await db.payrollRunCalculation.findFirstOrThrow({
          where: { runId: run.id },
          orderBy: { revision: "desc" },
        })
        await call(`/payroll/runs/${run.id}/reject`, approver, "POST", {
          calculationId: revision.id,
          reason: "Review the fictional allowance before the next cycle.",
        })
        run = await db.payrollRun.findUniqueOrThrow({ where: { id: run.id } })
      }
      let expected = (
        enrichTrend
          ? [
              "APPROVED",
              "APPROVED",
              "PENDING_APPROVAL",
              "REJECTED",
              "APPROVED",
              "APPROVED",
            ]
          : [
              "APPROVED",
              "APPROVED",
              "PENDING_APPROVAL",
              "REJECTED",
              "DRAFT",
              "DRAFT",
            ]
      )[index]
      if (!enrichTrend && index >= 4 && run.status === "APPROVED") {
        const seededRevisions = await db.employeeCompensation.count({
          where: {
            employeeId: {
              in: Array.from({ length: 20 }, (_, i) =>
                showcaseId("employee", i),
              ),
            },
            effectiveFrom: months[index],
            changeReason: `Fictional showcase trend revision ${index - 3}`,
          },
        })
        if (seededRevisions !== 20)
          throw new Error(
            "The approved trend period does not match the showcase revisions",
          )
        expected = "APPROVED"
      }
      if (run.status !== expected)
        throw new Error(
          `Unexpected payroll status for ${dateKey(months[index])}: ${run.status}`,
        )
      if (run.status === "APPROVED") {
        await call(`/payroll/runs/${run.id}/generate-payslips`, admin, "POST")
        await call(`/payroll/runs/${run.id}/publish-payslips`, admin, "POST")
        const batch = await call("/payroll/disbursements", admin, "POST", {
          runId: run.id,
        })
        const items = await db.payrollDisbursementItem.findMany({
          where: { batchId: batch.id },
          include: { destination: true, attempt: true },
          orderBy: { id: "asc" },
        })
        for (const [itemIndex, item] of items.entries()) {
          if (item.amount.isZero()) continue
          const kind = itemIndex % 2 ? "TEST_EWALLET" : "TEST_BANK"
          const outcome =
            itemIndex === 0
              ? "PENDING"
              : itemIndex === 1
                ? "FAILED"
                : "SUCCEEDED"
          if (!item.destination)
            await call(
              `/payroll/disbursements/${batch.id}/items/${item.id}/destination`,
              admin,
              "POST",
              { kind },
            )
          else if (item.destination.kind !== kind)
            throw new Error(
              "An existing test destination differs from the plan",
            )
          if (!item.attempt)
            await call(
              `/payroll/disbursements/${batch.id}/items/${item.id}/simulate`,
              admin,
              "POST",
              {
                outcome,
                idempotencyKey: showcaseUuid(
                  `payroll-${index}-payout`,
                  itemIndex,
                ),
              },
            )
          else if (item.attempt.outcome !== outcome)
            throw new Error(
              "An existing payout simulation differs from the plan",
            )
        }
      }
      summary.push({ period: dateKey(months[index]), status: run.status })
    }
    return { database: target.database, runs: summary, reviewer: reviewerEmail }
  } finally {
    for (const session of sessions) await authService.logout(session)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}
