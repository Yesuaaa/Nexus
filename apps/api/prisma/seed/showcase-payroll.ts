import { getPrisma } from "../../src/lib/db.js"
import type { AuthContext } from "../../src/features/auth/auth.middleware.js"
import { payrollService } from "../../src/features/payroll/payroll.service.js"
import { validateCompensationVersion } from "../../src/features/payroll/payroll.schema.js"
import { assertShowcaseRealtimeDisabled } from "./showcase-realtime.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { showcaseId } from "./showcase-plan.js"

/** A deterministic change to the Phase 1 compensation, validated like API input. */
export function showcaseCompensationRevision(
  index: number,
  firstEffectiveFrom: Date,
) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 20 ||
    !Number.isFinite(firstEffectiveFrom.getTime())
  )
    throw new Error("Invalid showcase employee or effective date")
  const effectiveFrom = new Date(
    Date.UTC(
      firstEffectiveFrom.getUTCFullYear(),
      firstEffectiveFrom.getUTCMonth() + 7,
      1,
    ),
  )
    .toISOString()
    .slice(0, 10)
  const parsed = validateCompensationVersion({
    payType: "MONTHLY",
    baseRate: (19000 + index * 2000).toFixed(2),
    currency: "PHP",
    effectiveFrom,
    changeReason: "Fictional showcase compensation review",
    components: [
      {
        type: "ALLOWANCE",
        name: "Communication allowance",
        amount: (1000 + (index % 4) * 250).toFixed(2),
      },
      {
        type: "RECURRING_DEDUCTION",
        name: "Fictional employee contribution",
        amount: (300 + (index % 3) * 100).toFixed(2),
      },
    ],
  })
  if (!("value" in parsed)) throw new Error(parsed.error)
  return parsed.value
}

/** Add only missing fictional revisions; existing non-showcase timelines are untouched. */
export async function seedShowcaseCompensation(auth: AuthContext) {
  const expectedTarget = assertPhase2Target(process.env)
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  await prisma.$transaction(async (tx) => {
    const [target] = await tx.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`
    if (target?.database !== expectedTarget.database)
      throw new Error(
        "The connected database does not match the confirmed target",
      )
    await assertShowcaseRealtimeDisabled(tx)
  })
  const session = await prisma.session.findUnique({
    where: { id: auth.sessionId },
    include: { user: true },
  })
  if (
    !session ||
    session.userId !== auth.user.id ||
    session.user.role !== "ADMIN" ||
    auth.user.role !== "ADMIN" ||
    !session.user.isActive ||
    session.user.accountDeletedAt ||
    session.expiresAt <= new Date() ||
    session.userId !== showcaseId("user", 1)
  )
    throw new Error(
      "An authenticated showcase payroll administrator is required",
    )
  const work = []
  for (let index = 0; index < 20; index++) {
    const employeeId = showcaseId("employee", index)
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        compensations: {
          include: { components: true },
          orderBy: { effectiveFrom: "asc" },
        },
      },
    })
    if (
      !employee ||
      employee.status !== "ACTIVE" ||
      employee.compensations[0]?.id !== showcaseId("compensation", index) ||
      employee.compensations.length > 2
    )
      throw new Error("Showcase compensation timeline is missing or modified")
    const revision = showcaseCompensationRevision(
      index,
      employee.compensations[0].effectiveFrom,
    )
    const existing = employee.compensations[1]
    if (
      existing &&
      (existing.effectiveFrom.getTime() !== revision.effectiveFrom.getTime() ||
        existing.payType !== revision.payType ||
        existing.currency.trim() !== revision.currency ||
        existing.baseRate.toFixed(2) !== revision.baseRate ||
        existing.changeReason !== revision.changeReason ||
        existing.components.length !== revision.components.length ||
        revision.components.some(
          (expected) =>
            !existing.components.some(
              (actual) =>
                actual.type === expected.type &&
                actual.name === expected.name &&
                actual.amount.toFixed(2) === expected.amount,
            ),
        ))
    )
      throw new Error(
        "Showcase compensation revision differs from the expected values",
      )
    if (!existing) work.push({ employeeId, revision })
  }
  for (const item of work)
    await payrollService.createCompensationVersion(
      auth,
      item.employeeId,
      item.revision,
    )
  return { employees: 20, created: work.length }
}
