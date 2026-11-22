import "dotenv/config"
import type { Prisma } from "../src/generated/prisma/client.js"
import { getPrisma } from "../src/lib/db.js"

const month = process.argv[2] ?? "2026-11"
const reportOnly = process.argv[3] === "--report"
const repair = process.argv[3] === "--repair-december-demo"
if (
  repair &&
  (month !== "2026-12" ||
    process.env.NODE_ENV !== "development" ||
    process.env.PAYROLL_LOCAL_SIMULATOR !== "true")
)
  throw new Error("December demo repair requires the local payroll simulator")
if (month !== "2026-11" && month !== "2026-12")
  throw new Error("Choose 2026-11 or 2026-12 for the payroll simulator fixture")
const start = new Date(`${month}-01`)
const end = new Date(month === "2026-11" ? "2026-11-30" : "2026-12-31")
const demoRates = ["18000.00", "22500.50", "27500.00", "34750.25", "48000.00"]
const prisma = getPrisma()
if (!prisma) throw new Error("Payroll demo seed requires a database connection")

try {
  const counts = await prisma.$transaction(
    async (tx) => {
      const runs = await tx.payrollRun.findMany({
        where: {
          status: { in: ["DRAFT", "CALCULATED"] },
          period: {
            cutoffLabel: month,
            endDate: end,
            configuration: { frequency: "MONTHLY" },
            ...(month === "2026-12" ? { startDate: start } : {}),
          },
          ...(month === "2026-11" ? { id: "cmwkfj2ay00063nnn6i5n91ku" } : {}),
        },
        select: { id: true, createdById: true, calculationCount: true },
        take: 2,
      })
      if (runs.length !== 1) return null
      const [run] = runs
      if (reportOnly || repair) {
        const outstanding = await tx.payrollRunItem.findMany({
          where: {
            calculation: { runId: run.id, revision: run.calculationCount },
            status: { not: "CALCULATED" },
          },
          orderBy: { employeeNumberSnapshot: "asc" },
          select: {
            employeeId: true,
            employeeNumberSnapshot: true,
            status: true,
            blocks: true,
            warnings: true,
          },
        })
        if (repair) return repairDecemberDemo(tx, outstanding)
        return {
          revision: run.calculationCount,
          outstanding: outstanding.map(
            ({ employeeNumberSnapshot, status, blocks, warnings }) => ({
              employee: employeeNumberSnapshot,
              status,
              issues: [...issueCodes(blocks), ...issueCodes(warnings)],
              missingAttendanceDates: missingAttendanceDates(warnings),
            }),
          ),
        }
      }

      const employees = await tx.employee.findMany({
        where: { OR: [{ startDate: null }, { startDate: { lte: end } }] },
        orderBy: { id: "asc" },
        select: {
          id: true,
          compensations: {
            where: {
              effectiveFrom: { lte: end },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
            },
            select: { id: true },
            take: 1,
          },
        },
      })
      const startDates = await tx.employee.updateMany({
        where: { id: { in: employees.map(({ id }) => id) }, startDate: null },
        data: { startDate: start },
      })
      const eligible = employees.filter(
        ({ compensations }) => compensations.length === 0,
      )
      const compensation = await tx.employeeCompensation.createManyAndReturn({
        data: eligible.map(({ id }, index) => ({
          employeeId: id,
          payType: "MONTHLY",
          baseRate:
            month === "2026-12"
              ? demoRates[index % demoRates.length]
              : "25000.00",
          currency: "PHP",
          effectiveFrom: start,
          effectiveTo: end,
          createdById: run.createdById,
          changeReason: `${month} payroll simulator fixture`,
        })),
        select: { id: true, employeeId: true },
      })
      const fixtureIds = new Map(
        compensation.map(({ id, employeeId }) => [employeeId, id]),
      )
      const components =
        month === "2026-12"
          ? eligible.flatMap(({ id }, index) => {
              const compensationId = fixtureIds.get(id)
              if (!compensationId)
                throw new Error("Missing compensation fixture")
              const allowance = {
                compensationId,
                type: "ALLOWANCE" as const,
                name: "Demo transport allowance",
                amount: "1500.50",
              }
              const deduction = {
                compensationId,
                type: "RECURRING_DEDUCTION" as const,
                name: "Demo recurring deduction",
                amount: "350.25",
              }
              if (index % 4 === 1) return [allowance]
              if (index % 4 === 2) return [deduction]
              if (index % 4 === 3) return [allowance, deduction]
              return []
            })
          : []
      if (components.length > 0)
        await tx.compensationComponent.createMany({ data: components })
      return {
        startDates: startDates.count,
        compensation: compensation.length,
        components: components.length,
      }
    },
    { isolationLevel: "Serializable", timeout: repair ? 120_000 : 5_000 },
  )
  if (counts) {
    console.log(JSON.stringify(counts, null, 2))
  } else {
    console.error(
      `Expected exactly one unsubmitted monthly payroll run for ${month}.`,
    )
    process.exitCode = 1
  }
} catch {
  console.error("Payroll demo seed failed. The transaction was rolled back.")
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}

async function repairDecemberDemo(
  tx: Prisma.TransactionClient,
  items: {
    employeeId: string
    employeeNumberSnapshot: string
    blocks: unknown
    warnings: unknown
  }[],
) {
  let statusesChanged = 0
  let sessionsCreated = 0
  for (const item of items) {
    const number = item.employeeNumberSnapshot
    if (
      ["EXP-000006", "EXP-000007"].includes(number) &&
      issueCodes(item.blocks).includes("LEAVE_POLICY_UNAVAILABLE")
    ) {
      const updated = await tx.employee.updateMany({
        where: { id: item.employeeId, employeeId: number, status: "ON_LEAVE" },
        data: { status: "ACTIVE" },
      })
      statusesChanged += updated.count
    }
    if (!["EXP-000001", "EXP-938629BE34"].includes(number)) continue
    for (const date of missingAttendanceDates(item.warnings)) {
      if (!date.startsWith("2026-12-")) continue
      const workDate = new Date(date)
      const assignments = await tx.attendancePolicyAssignment.findMany({
        where: {
          employeeId: item.employeeId,
          effectiveFrom: { lte: workDate },
          OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: workDate } }],
        },
        include: { policy: { include: { days: true } } },
        take: 2,
      })
      const policy = assignments[0]?.policy
      const day = policy?.days.find(
        ({ weekday }) => weekday === workDate.getUTCDay(),
      )
      if (
        assignments.length !== 1 ||
        !policy ||
        !day?.isWorkingDay ||
        day.requiredMinutes <= 0
      )
        throw new Error(
          `Expected one scheduled attendance policy for ${number} on ${date}`,
        )
      const [{ startedAt, nextDay }] = await tx.$queryRaw<
        { startedAt: Date; nextDay: Date }[]
      >`SELECT (${date}::date + TIME '07:00') AT TIME ZONE ${policy.timeZone} AS "startedAt",
        (${date}::date + 1)::timestamp AT TIME ZONE ${policy.timeZone} AS "nextDay"`
      const endedAt = new Date(
        startedAt.getTime() + day.requiredMinutes * 60_000,
      )
      if (endedAt >= nextDay)
        throw new Error(
          `Demo session would cross midnight for ${number} on ${date}`,
        )
      const existing = await tx.attendanceWorkSession.findFirst({
        where: {
          employeeId: item.employeeId,
          OR: [
            { workday: { workDate } },
            {
              startedAt: { lt: endedAt },
              OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
            },
          ],
        },
        select: { id: true },
      })
      if (existing) continue
      await tx.$executeRaw`SELECT set_config('app.attendance_reason', ${"December payroll simulator fixture"}, true)`
      await tx.attendanceWorkSession.create({
        data: {
          id: `demo-payroll-${item.employeeId}-${date}`,
          employeeId: item.employeeId,
          startedAt,
          endedAt,
        },
      })
      sessionsCreated += 1
    }
  }
  return { statusesChanged, sessionsCreated }
}

function issueCodes(issues: unknown): string[] {
  if (!Array.isArray(issues)) return []
  return [
    ...new Set(
      issues.flatMap((issue: unknown) =>
        typeof issue === "object" &&
        issue !== null &&
        "code" in issue &&
        typeof issue.code === "string"
          ? [issue.code]
          : [],
      ),
    ),
  ]
}

function missingAttendanceDates(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return []
  return [
    ...new Set(
      warnings.flatMap((warning: unknown) =>
        typeof warning === "object" &&
        warning !== null &&
        "code" in warning &&
        warning.code === "ATTENDANCE_RECORD_MISSING" &&
        "reference" in warning &&
        typeof warning.reference === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(warning.reference)
          ? [warning.reference]
          : [],
      ),
    ),
  ].sort()
}
