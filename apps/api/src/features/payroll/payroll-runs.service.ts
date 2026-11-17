import { randomUUID } from "node:crypto"
import {
  PayrollCalculationStatus,
  PayrollRunStatus,
  WorkforceManagementAction,
  WorkforceManagementOrigin,
  WorkforceManagementSubject,
  type Prisma,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail, HttpError } from "../../shared/http-error.js"
import { createManagementOperation } from "../../shared/management-history.js"
import { paginate, insensitive } from "../../shared/query/pagination.js"
import {
  writeWorkforceManagementChange,
  type PayrollApprovalAuditAction,
} from "../employees/workforce-management-history.js"
import type { AuthContext } from "../auth/auth.middleware.js"
import { attendanceWorkdayInclude } from "../attendance/attendance.repository.js"
import { manilaToday } from "./payroll.service.js"
import {
  generatePayrollPeriodCandidates,
  type PayrollPeriodConfiguration,
} from "./payroll-periods.js"
import {
  calculatePayrollEmployee,
  type PayrollEmployeeCalculationInput,
} from "./payroll-calculator.js"

const calculationSummarySelect = {
  id: true,
  revision: true,
  status: true,
  calculatedAt: true,
  currency: true,
  grossTotal: true,
  deductionsTotal: true,
  netTotal: true,
  calculatedItemCount: true,
  reviewItemCount: true,
  blockedItemCount: true,
} satisfies Prisma.PayrollRunCalculationSelect

const periodInclude = {
  configuration: {
    select: {
      id: true,
      frequency: true,
      firstCutoffDay: true,
      currency: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  },
  createdBy: { select: { id: true, fullName: true, role: true } },
  run: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      calculations: {
        orderBy: { revision: "desc" },
        take: 1,
        select: calculationSummarySelect,
      },
    },
  },
} satisfies Prisma.PayrollPeriodInclude

const runInclude = {
  period: { include: { configuration: periodInclude.configuration } },
  createdBy: { select: { id: true, fullName: true, role: true } },
  calculations: {
    orderBy: { revision: "desc" },
    select: {
      ...calculationSummarySelect,
      approvalEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      createdBy: { select: { id: true, fullName: true, role: true } },
    },
  },
} satisfies Prisma.PayrollRunInclude

const itemInclude = {
  components: {
    orderBy: [{ componentType: "asc" }, { name: "asc" }],
  },
  calculation: {
    select: { id: true, revision: true, status: true, calculatedAt: true },
  },
} satisfies Prisma.PayrollRunItemInclude

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function dateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function dateAtEndOfYear(year: number): Date {
  return new Date(Date.UTC(year, 11, 31))
}

function moneyString(value: Prisma.Decimal): string {
  return value.toFixed(2)
}

function calculationSummary<
  T extends {
    id: string
    revision: number
    status: PayrollCalculationStatus
    calculatedAt: Date
    currency: string
    grossTotal: Prisma.Decimal
    deductionsTotal: Prisma.Decimal
    netTotal: Prisma.Decimal
    calculatedItemCount: number
    reviewItemCount: number
    blockedItemCount: number
  },
>(value: T) {
  return {
    ...value,
    currency: value.currency.trim(),
    calculatedAt: value.calculatedAt.toISOString(),
    grossTotal: moneyString(value.grossTotal),
    deductionsTotal: moneyString(value.deductionsTotal),
    netTotal: moneyString(value.netTotal),
  }
}

function periodView<
  T extends {
    id: string
    configurationId: string
    startDate: Date
    endDate: Date
    cutoffLabel: string
    status: string
    createdAt: Date
    configuration: {
      id: string
      frequency: string
      firstCutoffDay: number | null
      currency: string
      effectiveFrom: Date
      effectiveTo: Date | null
    }
    createdBy: { id: string; fullName: string | null; role: string }
    run: null | {
      id: string
      status: string
      createdAt: Date
      calculations: Parameters<typeof calculationSummary>[0][]
    }
  },
>(value: T) {
  const latest = value.run?.calculations[0]
  return {
    id: value.id,
    configurationId: value.configurationId,
    startDate: dateKey(value.startDate),
    endDate: dateKey(value.endDate),
    cutoffLabel: value.cutoffLabel,
    status: value.status,
    frequency: value.configuration.frequency,
    firstCutoffDay: value.configuration.firstCutoffDay,
    currency: value.configuration.currency.trim(),
    configuration: {
      id: value.configuration.id,
      frequency: value.configuration.frequency,
      firstCutoffDay: value.configuration.firstCutoffDay,
      currency: value.configuration.currency.trim(),
      effectiveFrom: dateKey(value.configuration.effectiveFrom),
      effectiveTo: value.configuration.effectiveTo
        ? dateKey(value.configuration.effectiveTo)
        : null,
    },
    createdAt: value.createdAt.toISOString(),
    createdBy: value.createdBy,
    run: value.run
      ? {
          id: value.run.id,
          status: value.run.status,
          createdAt: value.run.createdAt.toISOString(),
          latestCalculation: latest ? calculationSummary(latest) : null,
        }
      : null,
  }
}

function runView<
  T extends {
    id: string
    status: string
    calculationCount: number
    createdAt: Date
    updatedAt: Date
    createdBy: { id: string; fullName: string | null; role: string }
    period: {
      id: string
      configurationId: string
      startDate: Date
      endDate: Date
      cutoffLabel: string
      status: string
      createdAt: Date
      configuration: {
        id: string
        frequency: string
        firstCutoffDay: number | null
        currency: string
        effectiveFrom: Date
        effectiveTo: Date | null
      }
    }
    calculations: (Parameters<typeof calculationSummary>[0] & {
      approvalEvents?: Prisma.PayrollApprovalEventGetPayload<object>[]
      createdBy?: { id: string; fullName: string | null; role: string }
    })[]
  },
>(value: T) {
  const history = value.calculations.map((item) => ({
    ...calculationSummary(item),
    ...(item.createdBy ? { createdBy: item.createdBy } : {}),
    approvalEvents: item.approvalEvents ?? [],
  }))
  return {
    id: value.id,
    status: value.status,
    calculationCount: value.calculationCount,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    createdBy: value.createdBy,
    period: {
      id: value.period.id,
      configurationId: value.period.configurationId,
      startDate: dateKey(value.period.startDate),
      endDate: dateKey(value.period.endDate),
      cutoffLabel: value.period.cutoffLabel,
      status: value.period.status,
      frequency: value.period.configuration.frequency,
      firstCutoffDay: value.period.configuration.firstCutoffDay,
      currency: value.period.configuration.currency.trim(),
    },
    latestCalculation: history[0] ?? null,
    calculationHistory: history,
  }
}

function itemView<
  T extends {
    id: string
    employeeId: string
    employeeNumberSnapshot: string
    employeeNameSnapshot: string
    employmentTypeSnapshot: string
    status: string
    currency: string
    grossAmount: Prisma.Decimal | null
    deductionsAmount: Prisma.Decimal | null
    netAmount: Prisma.Decimal | null
    compensationSnapshot: Prisma.JsonValue
    attendanceSnapshot: Prisma.JsonValue
    warnings: Prisma.JsonValue
    blocks: Prisma.JsonValue
    calculation: {
      id: string
      revision: number
      status: string
      calculatedAt: Date
    }
    components: {
      id: string
      componentType: string
      status: string
      sourceId: string | null
      name: string
      amount: Prisma.Decimal | null
      metadata: Prisma.JsonValue
    }[]
  },
>(value: T) {
  return {
    id: value.id,
    employeeId: value.employeeId,
    employeeNumber: value.employeeNumberSnapshot,
    employeeName: value.employeeNameSnapshot,
    employmentType: value.employmentTypeSnapshot,
    status: value.status,
    currency: value.currency.trim(),
    grossAmount: value.grossAmount ? moneyString(value.grossAmount) : null,
    deductionsAmount: value.deductionsAmount
      ? moneyString(value.deductionsAmount)
      : null,
    netAmount: value.netAmount ? moneyString(value.netAmount) : null,
    compensationSnapshot: value.compensationSnapshot,
    attendanceSnapshot: value.attendanceSnapshot,
    warnings: value.warnings,
    blocks: value.blocks,
    calculation: {
      ...value.calculation,
      calculatedAt: value.calculation.calculatedAt.toISOString(),
    },
    components: value.components.map((component) => ({
      id: component.id,
      componentType: component.componentType,
      status: component.status,
      sourceId: component.sourceId,
      name: component.name,
      amount: component.amount ? moneyString(component.amount) : null,
      metadata: component.metadata,
    })),
  }
}

function payrollOperation(auth: AuthContext) {
  return createManagementOperation(auth)
}

function plusOneDay(date: Date): Date {
  return new Date(date.getTime() + 86_400_000)
}

function dateRangeDates(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  for (
    let cursor = dateFromKey(startDate);
    cursor <= dateFromKey(endDate);
    cursor = plusOneDay(cursor)
  )
    dates.push(dateKey(cursor))
  return dates
}

function sumMoney(values: (string | null)[]): string {
  let total = 0n
  for (const value of values) {
    if (value === null) continue
    const [whole, fraction = ""] = value.split(".")
    total += BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))
  }
  if (total > 99_999_999_999_999n)
    fail(422, "Payroll run total exceeds the supported amount range")
  return `${(total / 100n).toString()}.${(total % 100n).toString().padStart(2, "0")}`
}

function expectedAttendance(
  employeeStartDate: Date | null,
  periodStart: string,
  periodEnd: string,
  assignments: {
    id: string
    effectiveFrom: Date
    effectiveUntil: Date | null
    policy: {
      id: string
      name: string
      days: {
        weekday: number
        isWorkingDay: boolean
        requiredMinutes: number
      }[]
    }
  }[],
) {
  const from =
    employeeStartDate && dateKey(employeeStartDate) > periodStart
      ? dateKey(employeeStartDate)
      : periodStart
  const expectedWorkdays: PayrollEmployeeCalculationInput["attendance"]["expectedWorkdays"] =
    []
  let policyMissing = false
  for (const workDate of dateRangeDates(from, periodEnd)) {
    const matches = assignments.filter(
      (assignment) =>
        dateKey(assignment.effectiveFrom) <= workDate &&
        (!assignment.effectiveUntil ||
          dateKey(assignment.effectiveUntil) > workDate),
    )
    if (matches.length !== 1) {
      policyMissing = true
      continue
    }
    const assignment = matches[0]!
    const weekday = dateFromKey(workDate).getUTCDay()
    const policyDay = assignment.policy.days.find(
      (day) => day.weekday === weekday,
    )
    if (!policyDay) {
      policyMissing = true
      continue
    }
    if (!policyDay.isWorkingDay || policyDay.requiredMinutes <= 0) continue
    expectedWorkdays.push({
      workDate,
      assignmentId: assignment.id,
      policyId: assignment.policy.id,
      policyName: assignment.policy.name,
      isWorkingDay: policyDay.isWorkingDay,
      requiredMinutes: policyDay.requiredMinutes,
    })
  }
  return { policyMissing, expectedWorkdays }
}

function inputForEmployee(
  period: {
    startDate: Date
    endDate: Date
    configuration: {
      frequency: "MONTHLY" | "SEMI_MONTHLY"
      currency: string
    }
  },
  employee: {
    id: string
    employeeId: string
    fullName: string
    employmentType: PayrollEmployeeCalculationInput["employee"]["employmentType"]
    status: PayrollEmployeeCalculationInput["employee"]["status"]
    startDate: Date | null
    compensations: {
      id: string
      payType: PayrollEmployeeCalculationInput["compensationVersions"][number]["payType"]
      baseRate: Prisma.Decimal
      currency: string
      effectiveFrom: Date
      effectiveTo: Date | null
      components: {
        id: string
        type: PayrollEmployeeCalculationInput["compensationVersions"][number]["components"][number]["type"]
        name: string
        amount: Prisma.Decimal
        calculationType: "FIXED"
      }[]
    }[]
    attendanceAssignments: {
      id: string
      effectiveFrom: Date
      effectiveUntil: Date | null
      policy: {
        id: string
        name: string
        days: {
          weekday: number
          isWorkingDay: boolean
          requiredMinutes: number
        }[]
      }
    }[]
    attendanceWorkdays: {
      id: string
      workDate: Date
      assignmentId: string
      policyName: string
      timeZone: string
      isWorkingDay: boolean
      requiredMinutes: number
      unpaidBreaksEnabled: boolean
      overnightRequiresReview: boolean
      assignment: { policy: { id: string } }
      sessions: {
        id: string
        startedAt: Date
        endedAt: Date | null
        breaks: {
          id: string
          startedAt: Date
          endedAt: Date | null
          isPaid: boolean
        }[]
        adjustments: { id: string }[]
      }[]
    }[]
    attendanceAdjustments: {
      id: string
      status: PayrollEmployeeCalculationInput["attendance"]["overtimeAdjustments"][number]["status"]
      overtimeMinutes: number
    }[]
  },
): PayrollEmployeeCalculationInput {
  const startDate = dateKey(period.startDate)
  const endDate = dateKey(period.endDate)
  const expected = expectedAttendance(
    employee.startDate,
    startDate,
    endDate,
    employee.attendanceAssignments,
  )
  const workdays = employee.attendanceWorkdays.map((day) => ({
    id: day.id,
    workDate: dateKey(day.workDate),
    assignmentId: day.assignmentId,
    policyId: day.assignment.policy.id,
    policyName: day.policyName,
    timeZone: day.timeZone,
    isWorkingDay: day.isWorkingDay,
    requiredMinutes: day.requiredMinutes,
    unpaidBreaksEnabled: day.unpaidBreaksEnabled,
    overnightRequiresReview: day.overnightRequiresReview,
    sessions: day.sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      breaks: session.breaks.map((pause) => ({
        id: pause.id,
        startedAt: pause.startedAt,
        endedAt: pause.endedAt,
        isPaid: pause.isPaid,
      })),
      pendingCorrections: session.adjustments.map(({ id }) => id),
    })),
  }))
  return {
    period: {
      startDate,
      endDate,
      frequency: period.configuration.frequency,
      currency: period.configuration.currency.trim(),
    },
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeId,
      fullName: employee.fullName,
      employmentType: employee.employmentType,
      status: employee.status,
      startDate: employee.startDate ? dateKey(employee.startDate) : null,
    },
    compensationVersions: employee.compensations.map((version) => ({
      id: version.id,
      payType: version.payType,
      baseRate: version.baseRate.toFixed(2),
      currency: version.currency.trim(),
      effectiveFrom: dateKey(version.effectiveFrom),
      effectiveTo: version.effectiveTo ? dateKey(version.effectiveTo) : null,
      components: version.components.map((component) => ({
        id: component.id,
        type: component.type,
        name: component.name,
        amount: component.amount.toFixed(2),
        calculationType: component.calculationType,
      })),
    })),
    attendance: {
      policyMissing: expected.policyMissing,
      expectedWorkdays: expected.expectedWorkdays,
      workdays,
      overtimeAdjustments: employee.attendanceAdjustments.map((adjustment) => ({
        id: adjustment.id,
        status: adjustment.status,
        overtimeMinutes: adjustment.overtimeMinutes,
      })),
    },
  }
}

function periodConfiguration(configuration: {
  id: string
  frequency: "MONTHLY" | "SEMI_MONTHLY"
  firstCutoffDay: number | null
  effectiveFrom: Date
  effectiveTo: Date | null
}): PayrollPeriodConfiguration {
  return {
    ...configuration,
    effectiveFrom: dateKey(configuration.effectiveFrom),
    effectiveTo: configuration.effectiveTo
      ? dateKey(configuration.effectiveTo)
      : null,
  }
}

type ApprovalAction = "submit" | "approve" | "reject"

async function recordApprovalEvent(
  tx: Prisma.TransactionClient,
  auth: AuthContext,
  runId: string,
  calculationId: string,
  action: PayrollApprovalAuditAction,
  reason?: string,
) {
  await tx.payrollApprovalEvent.create({
    data: {
      calculationId,
      action,
      actorId: auth.user.id,
      actorName: auth.user.fullName,
      reason,
    },
  })
  await writeWorkforceManagementChange(tx, payrollOperation(auth), {
    action,
    origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
    subjectType: WorkforceManagementSubject.PAYROLL_RUN,
    subjectId: runId,
    changedFields: [
      "status",
      "calculationId",
      ...(reason ? ["reason" as const] : []),
    ],
    changes: { calculationId, ...(reason ? { reason } : {}) },
  })
}
export const payrollRunsService = {
  async transitionApproval(
    auth: AuthContext,
    runId: string,
    calculationId: string,
    action: ApprovalAction,
    reason?: string,
  ) {
    return getPrisma()!.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(848225, hashtext(${runId}))`
      const run = await tx.payrollRun.findUnique({
        where: { id: runId },
        include: runInclude,
      })
      if (!run) fail(404, "Payroll run not found")
      const revision = run.calculations[0]
      if (
        !revision ||
        revision.id !== calculationId ||
        revision.revision !== run.calculationCount
      )
        fail(
          409,
          "The payroll calculation changed; refresh and review the current revision",
        )
      if (
        run.status !== (action === "submit" ? "CALCULATED" : "PENDING_APPROVAL")
      )
        fail(
          409,
          "This payroll action is unavailable in the current run status",
        )
      const submitted = revision.approvalEvents.some(
        ({ action }) =>
          action === "PAYROLL_SUBMITTED" || action === "PAYROLL_RESUBMITTED",
      )
      if (submitted !== (action !== "submit"))
        fail(409, "The current revision does not match the approval workflow")
      if (
        action !== "reject" &&
        (revision.status !== "COMPLETE" ||
          !revision.calculatedItemCount ||
          revision.reviewItemCount ||
          revision.blockedItemCount)
      )
        fail(409, "Resolve all employee calculation issues before approval")
      if (
        action === "approve" &&
        [run.createdById, revision.createdBy.id].includes(auth.user.id)
      )
        fail(
          403,
          "The run preparer and calculation author cannot approve this revision",
        )
      const status =
        action === "submit"
          ? "PENDING_APPROVAL"
          : action === "approve"
            ? "APPROVED"
            : "REJECTED"
      const event =
        action === "submit"
          ? run.calculations.some((item) => item.approvalEvents.length)
            ? "PAYROLL_RESUBMITTED"
            : "PAYROLL_SUBMITTED"
          : action === "approve"
            ? "PAYROLL_APPROVED"
            : "PAYROLL_REJECTED"
      await tx.payrollRun.update({ where: { id: runId }, data: { status } })
      await recordApprovalEvent(tx, auth, runId, calculationId, event, reason)
      return runView(
        await tx.payrollRun.findUniqueOrThrow({
          where: { id: runId },
          include: runInclude,
        }),
      )
    })
  },

  async listPeriods(input: { page: number; year: number | null }) {
    const where: Prisma.PayrollPeriodWhereInput = input.year
      ? {
          startDate: { lte: dateAtEndOfYear(input.year) },
          endDate: { gte: new Date(Date.UTC(input.year, 0, 1)) },
        }
      : {}
    const page = await paginate(input.page, {
      rows: (db, window) =>
        db.payrollPeriod.findMany({
          where,
          orderBy: [{ startDate: "desc" }, { id: "desc" }],
          ...window,
          include: periodInclude,
        }),
      count: (db) => db.payrollPeriod.count({ where }),
    })
    return { ...page, rows: page.rows.map(periodView) }
  },

  async currentPeriod() {
    const prisma = getPrisma()!
    const today = manilaToday()
    const current = await prisma.payrollConfiguration.findFirst({
      where: {
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      orderBy: { effectiveFrom: "desc" },
    })
    if (!current)
      return { today: dateKey(today), candidate: null, period: null }
    const configuration = periodConfiguration(current)
    const candidate = generatePayrollPeriodCandidates(
      configuration,
      today.getUTCFullYear(),
    ).find(
      (item) =>
        item.startDate <= dateKey(today) && item.endDate >= dateKey(today),
    )
    if (!candidate)
      return { today: dateKey(today), candidate: null, period: null }
    const period = await prisma.payrollPeriod.findUnique({
      where: {
        configurationId_startDate_endDate: {
          configurationId: candidate.configurationId,
          startDate: dateFromKey(candidate.startDate),
          endDate: dateFromKey(candidate.endDate),
        },
      },
      include: periodInclude,
    })
    return {
      today: dateKey(today),
      candidate,
      period: period ? periodView(period) : null,
    }
  },

  async generatePeriods(auth: AuthContext, year: number) {
    const prisma = getPrisma()!
    const operation = payrollOperation(auth)
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = dateAtEndOfYear(year)
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(848223, ${year})`
        const configurations = await tx.payrollConfiguration.findMany({
          where: {
            effectiveFrom: { lte: yearEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: yearStart } }],
          },
          orderBy: { effectiveFrom: "asc" },
        })
        if (configurations.length === 0)
          fail(409, "No payroll schedule covers the selected year")
        const candidates = configurations
          .flatMap((configuration) =>
            generatePayrollPeriodCandidates(
              periodConfiguration(configuration),
              year,
            ),
          )
          .sort(
            (a, b) =>
              a.startDate.localeCompare(b.startDate) ||
              a.configurationId.localeCompare(b.configurationId),
          )
        for (let index = 1; index < candidates.length; index += 1) {
          if (candidates[index]!.startDate <= candidates[index - 1]!.endDate)
            fail(409, "Payroll schedules overlap within the selected year")
        }
        const rows = []
        let createdCount = 0
        for (const candidate of candidates) {
          const key = {
            configurationId_startDate_endDate: {
              configurationId: candidate.configurationId,
              startDate: dateFromKey(candidate.startDate),
              endDate: dateFromKey(candidate.endDate),
            },
          }
          let period = await tx.payrollPeriod.findUnique({ where: key })
          if (!period) {
            period = await tx.payrollPeriod.create({
              data: {
                configurationId: candidate.configurationId,
                startDate: dateFromKey(candidate.startDate),
                endDate: dateFromKey(candidate.endDate),
                cutoffLabel: candidate.cutoffLabel,
                createdById: auth.user.id,
              },
            })
            createdCount += 1
            await writeWorkforceManagementChange(tx, operation, {
              action: WorkforceManagementAction.PAYROLL_PERIOD_CREATED,
              origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
              subjectType: WorkforceManagementSubject.PAYROLL_PERIOD,
              subjectId: period.id,
              changedFields: [
                "configurationId",
                "startDate",
                "endDate",
                "frequency",
              ],
              changes: {
                configurationId: candidate.configurationId,
                startDate: candidate.startDate,
                endDate: candidate.endDate,
                frequency: candidate.frequency,
              },
            })
          }
          rows.push(period)
        }
        const detailed = await tx.payrollPeriod.findMany({
          where: { id: { in: rows.map(({ id }) => id) } },
          orderBy: [{ startDate: "asc" }, { id: "asc" }],
          include: periodInclude,
        })
        return {
          year,
          createdCount,
          total: detailed.length,
          rows: detailed.map(periodView),
        }
      },
      { isolationLevel: "Serializable" },
    )
  },

  async listRuns(input: {
    page: number
    search: string
    status: "" | PayrollRunStatus
    approvals?: boolean
    frequency: "" | "MONTHLY" | "SEMI_MONTHLY"
  }) {
    const and: Prisma.PayrollRunWhereInput[] = []
    if (input.status) and.push({ status: input.status })
    if (input.approvals)
      and.push({ calculations: { some: { approvalEvents: { some: {} } } } })
    if (input.frequency)
      and.push({
        period: {
          is: { configuration: { is: { frequency: input.frequency } } },
        },
      })
    const search = insensitive<Prisma.PayrollRunWhereInput>(input.search, [
      "id",
      (filter) => ({ period: { is: { cutoffLabel: filter } } }),
    ])
    if (search.OR) and.push(search)
    const where: Prisma.PayrollRunWhereInput = and.length ? { AND: and } : {}
    const page = await paginate(input.page, {
      rows: (db, window) =>
        db.payrollRun.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          ...window,
          include: runInclude,
        }),
      count: (db) => db.payrollRun.count({ where }),
    })
    return { ...page, rows: page.rows.map(runView) }
  },

  async createRun(auth: AuthContext, periodId: string) {
    const prisma = getPrisma()!
    const operation = payrollOperation(auth)
    const created = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(848224, hashtext(${periodId}))`
        const period = await tx.payrollPeriod.findUnique({
          where: { id: periodId },
          select: { id: true },
        })
        if (!period) fail(404, "Payroll period not found")
        if (await tx.payrollRun.findUnique({ where: { periodId } }))
          fail(409, "A payroll run already exists for this period")
        const run = await tx.payrollRun.create({
          data: { periodId, createdById: auth.user.id },
        })
        await writeWorkforceManagementChange(tx, operation, {
          action: WorkforceManagementAction.PAYROLL_RUN_CREATED,
          origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
          subjectType: WorkforceManagementSubject.PAYROLL_RUN,
          subjectId: run.id,
          changedFields: ["periodId"],
          changes: { periodId },
        })
        return tx.payrollRun.findUniqueOrThrow({
          where: { id: run.id },
          include: runInclude,
        })
      },
      { isolationLevel: "Serializable" },
    )
    return runView(created)
  },

  async getRun(runId: string) {
    const run = await getPrisma()!.payrollRun.findUnique({
      where: { id: runId },
      include: runInclude,
    })
    if (!run) fail(404, "Payroll run not found")
    return runView(run)
  },

  async listItems(input: {
    runId: string
    page: number
    search: string
    calculationId: string
  }) {
    const prisma = getPrisma()!
    const run = await prisma.payrollRun.findUnique({
      where: { id: input.runId },
      select: {
        id: true,
        calculations: { orderBy: { revision: "desc" }, select: { id: true } },
      },
    })
    if (!run) fail(404, "Payroll run not found")
    const selectedCalculationId =
      input.calculationId || run.calculations[0]?.id || ""
    if (
      input.calculationId &&
      !run.calculations.some(({ id }) => id === input.calculationId)
    )
      fail(404, "Payroll calculation revision not found")
    if (!selectedCalculationId)
      return {
        rows: [],
        total: 0,
        page: input.page,
        pageSize: 10,
        calculationId: null,
      }
    const where: Prisma.PayrollRunItemWhereInput = {
      calculationId: selectedCalculationId,
      ...insensitive<Prisma.PayrollRunItemWhereInput>(input.search, [
        "employeeNameSnapshot",
        "employeeNumberSnapshot",
      ]),
    }
    const page = await paginate(input.page, {
      rows: (db, window) =>
        db.payrollRunItem.findMany({
          where,
          orderBy: [{ employeeNameSnapshot: "asc" }, { id: "asc" }],
          ...window,
          include: itemInclude,
        }),
      count: (db) => db.payrollRunItem.count({ where }),
    })
    return {
      ...page,
      calculationId: selectedCalculationId,
      rows: page.rows.map(itemView),
    }
  },

  async getItem(runId: string, itemId: string) {
    const item = await getPrisma()!.payrollRunItem.findFirst({
      where: { id: itemId, calculation: { runId } },
      include: itemInclude,
    })
    if (!item) fail(404, "Payroll run item not found")
    return itemView(item)
  },

  async calculateRun(auth: AuthContext, runId: string) {
    const prisma = getPrisma()!
    const operation = payrollOperation(auth)
    const existing = await prisma.payrollRun.findUnique({
      where: { id: runId },
      select: { id: true, calculationCount: true, status: true },
    })
    if (!existing) fail(404, "Payroll run not found")
    if (
      existing.status === "PENDING_APPROVAL" ||
      existing.status === "APPROVED"
    )
      fail(409, "Pending or approved payroll runs cannot be recalculated")
    const revision = existing.calculationCount + 1
    const attemptId = randomUUID()
    try {
      const calculated = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(848225, hashtext(${runId}))`
          const claim = await tx.payrollRun.updateMany({
            where: {
              id: runId,
              calculationCount: existing.calculationCount,
              status: existing.status,
            },
            data: {
              calculationCount: revision,
              status: PayrollRunStatus.CALCULATED,
            },
          })
          if (claim.count !== 1)
            fail(409, "This payroll run changed; refresh and calculate again")
          const run = await tx.payrollRun.findUnique({
            where: { id: runId },
            include: {
              period: {
                include: {
                  configuration: {
                    select: {
                      id: true,
                      frequency: true,
                      firstCutoffDay: true,
                      currency: true,
                      effectiveFrom: true,
                      effectiveTo: true,
                    },
                  },
                },
              },
              calculations: {
                orderBy: { revision: "desc" },
                take: 1,
                select: { id: true },
              },
            },
          })
          if (!run) fail(404, "Payroll run not found")
          const previousCalculationId = run.calculations[0]?.id ?? null
          const employees = await tx.employee.findMany({
            where: {
              OR: [
                { startDate: null },
                { startDate: { lte: run.period.endDate } },
              ],
            },
            orderBy: [{ fullName: "asc" }, { id: "asc" }],
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              employmentType: true,
              status: true,
              startDate: true,
              compensations: {
                where: {
                  effectiveFrom: { lte: run.period.endDate },
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: run.period.startDate } },
                  ],
                },
                orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
                include: {
                  components: {
                    orderBy: [{ type: "asc" }, { name: "asc" }, { id: "asc" }],
                  },
                },
              },
              attendanceAssignments: {
                where: {
                  effectiveFrom: { lte: run.period.endDate },
                  OR: [
                    { effectiveUntil: null },
                    { effectiveUntil: { gt: run.period.startDate } },
                  ],
                },
                orderBy: [{ effectiveFrom: "asc" }, { id: "asc" }],
                include: {
                  policy: {
                    include: { days: { orderBy: { weekday: "asc" } } },
                  },
                },
              },
              attendanceWorkdays: {
                where: {
                  workDate: {
                    gte: run.period.startDate,
                    lte: run.period.endDate,
                  },
                },
                orderBy: [{ workDate: "asc" }, { id: "asc" }],
                include: attendanceWorkdayInclude,
              },
              attendanceAdjustments: {
                where: {
                  type: "OVERTIME",
                  session: {
                    workday: {
                      workDate: {
                        gte: run.period.startDate,
                        lte: run.period.endDate,
                      },
                    },
                  },
                },
                select: { id: true, status: true, overtimeMinutes: true },
              },
            },
          })
          if (employees.length === 0)
            fail(409, "No employees are eligible for this payroll period")
          const period = {
            startDate: run.period.startDate,
            endDate: run.period.endDate,
            configuration: run.period.configuration,
          }
          const inputs = employees.map((employee) =>
            inputForEmployee(period, employee),
          )
          const results = inputs.map(calculatePayrollEmployee)
          const calculatedCount = results.filter(
            (item) => item.status === "CALCULATED",
          ).length
          const reviewCount = results.filter(
            (item) => item.status === "REVIEW_REQUIRED",
          ).length
          const blockedCount = results.filter(
            (item) => item.status === "BLOCKED",
          ).length
          const status =
            calculatedCount === results.length
              ? PayrollCalculationStatus.COMPLETE
              : calculatedCount === 0
                ? PayrollCalculationStatus.BLOCKED
                : PayrollCalculationStatus.REVIEW_REQUIRED
          const grossTotal = sumMoney(
            results
              .filter((item) => item.status === "CALCULATED")
              .map((item) => item.grossAmount),
          )
          const deductionsTotal = sumMoney(
            results
              .filter((item) => item.status === "CALCULATED")
              .map((item) => item.deductionsAmount),
          )
          const netTotal = sumMoney(
            results
              .filter((item) => item.status === "CALCULATED")
              .map((item) => item.netAmount),
          )
          const calculation = await tx.payrollRunCalculation.create({
            data: {
              runId,
              revision,
              status,
              createdById: auth.user.id,
              currency: run.period.configuration.currency,
              grossTotal,
              deductionsTotal,
              netTotal,
              calculatedItemCount: calculatedCount,
              reviewItemCount: reviewCount,
              blockedItemCount: blockedCount,
              inputSnapshot: {
                algorithmVersion: "conservative-1",
                period: {
                  id: run.period.id,
                  startDate: dateKey(run.period.startDate),
                  endDate: dateKey(run.period.endDate),
                  configurationId: run.period.configurationId,
                  frequency: run.period.configuration.frequency,
                  firstCutoffDay: run.period.configuration.firstCutoffDay,
                  currency: run.period.configuration.currency.trim(),
                },
                employeeCount: results.length,
                totalsIncludeOnly:
                  "CALCULATED items; review and blocked results are excluded",
              },
              items: {
                create: results.map((item) => ({
                  employeeId: item.employee.id,
                  employeeNumberSnapshot: item.employee.employeeNumber,
                  employeeNameSnapshot: item.employee.fullName,
                  employmentTypeSnapshot: item.employee.employmentType,
                  status: item.status,
                  currency: item.currency,
                  grossAmount: item.grossAmount,
                  deductionsAmount: item.deductionsAmount,
                  netAmount: item.netAmount,
                  compensationSnapshot:
                    item.compensationSnapshot as Prisma.InputJsonValue,
                  attendanceSnapshot:
                    item.attendanceSnapshot as Prisma.InputJsonValue,
                  warnings: item.warnings as Prisma.InputJsonValue,
                  blocks: item.blocks as Prisma.InputJsonValue,
                  components: {
                    create: item.components.map((component) => ({
                      componentType: component.componentType,
                      status: component.status,
                      sourceId: component.sourceId,
                      name: component.name,
                      amount: component.amount,
                      metadata: component.metadata as Prisma.InputJsonValue,
                    })),
                  },
                })),
              },
            },
            select: { id: true },
          })
          await writeWorkforceManagementChange(tx, operation, {
            action: previousCalculationId
              ? WorkforceManagementAction.PAYROLL_RECALCULATED
              : WorkforceManagementAction.PAYROLL_CALCULATED,
            origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
            subjectType: WorkforceManagementSubject.PAYROLL_RUN,
            subjectId: runId,
            changedFields: [
              "calculationId",
              "previousCalculationId",
              "revision",
            ],
            changes: {
              calculationId: calculation.id,
              previousCalculationId,
              revision,
            },
          })
          if (existing.status === "REJECTED" && previousCalculationId)
            await recordApprovalEvent(
              tx,
              auth,
              runId,
              previousCalculationId,
              "PAYROLL_RETURNED_FOR_REVISION",
            )
          return tx.payrollRun.findUniqueOrThrow({
            where: { id: runId },
            include: runInclude,
          })
        },
        { isolationLevel: "Serializable" },
      )
      return runView(calculated)
    } catch (error) {
      const failureCode =
        error instanceof HttpError && error.status < 500
          ? "CALCULATION_INPUT_INVALID"
          : "CALCULATION_FAILED"
      try {
        await prisma.$transaction((tx) =>
          writeWorkforceManagementChange(tx, operation, {
            action: WorkforceManagementAction.PAYROLL_CALCULATION_FAILED,
            origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
            subjectType: WorkforceManagementSubject.PAYROLL_RUN,
            subjectId: runId,
            changedFields: ["attemptId", "revision", "failureCode"],
            changes: { attemptId, revision, failureCode },
          }),
        )
      } catch {
        // The calculation failure response must not expose payroll payloads if audit storage is unavailable.
      }
      throw error
    }
  },
}
