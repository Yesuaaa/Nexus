import {
  CompensationComponentType,
  EmployeeStatus,
  PayrollFrequency,
  PayrollPayType,
  WorkforceManagementAction,
  WorkforceManagementOrigin,
  WorkforceManagementSubject,
  type Prisma,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { manilaCalendarDay } from "../../shared/calendar-date.js"
import { fail } from "../../shared/http-error.js"
import { paginate, insensitive } from "../../shared/query/pagination.js"
import {
  createManagementOperation,
  type ManagementOperation,
} from "../../shared/management-history.js"
import type { AuthContext } from "../auth/auth.middleware.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"
import type {
  CompensationVersionInput,
  PayrollConfigurationInput,
} from "./payroll.schema.js"

const compensationSelect = {
  id: true,
  payType: true,
  baseRate: true,
  currency: true,
  effectiveFrom: true,
  effectiveTo: true,
  changeReason: true,
  createdAt: true,
  components: {
    select: {
      id: true,
      type: true,
      name: true,
      amount: true,
      calculationType: true,
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  },
} satisfies Prisma.EmployeeCompensationSelect

const configurationSelect = {
  id: true,
  frequency: true,
  firstCutoffDay: true,
  currency: true,
  effectiveFrom: true,
  effectiveTo: true,
  changeReason: true,
  createdAt: true,
} satisfies Prisma.PayrollConfigurationSelect

export const manilaToday = manilaCalendarDay

function daysBefore(date: Date) {
  return new Date(date.getTime() - 86_400_000)
}

function isCurrent(
  record: { effectiveFrom: Date; effectiveTo: Date | null },
  today: Date,
) {
  return (
    record.effectiveFrom <= today &&
    (!record.effectiveTo || record.effectiveTo >= today)
  )
}

function mapComponent(component: {
  id: string
  type: CompensationComponentType
  name: string
  amount: Prisma.Decimal
  calculationType: "FIXED"
}) {
  return { ...component, amount: component.amount.toFixed(2) }
}

function mapCompensation<
  T extends {
    baseRate: Prisma.Decimal
    currency: string
    effectiveFrom: Date
    effectiveTo: Date | null
    components: Parameters<typeof mapComponent>[0][]
  },
>(value: T) {
  return {
    ...value,
    baseRate: value.baseRate.toFixed(2),
    currency: value.currency.trim(),
    effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: value.effectiveTo?.toISOString().slice(0, 10) ?? null,
    components: value.components.map(mapComponent),
  }
}

function mapConfiguration<
  T extends {
    currency: string
    effectiveFrom: Date
    effectiveTo: Date | null
    frequency: PayrollFrequency
    firstCutoffDay: number | null
  },
>(value: T) {
  return {
    ...value,
    currency: value.currency.trim(),
    effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: value.effectiveTo?.toISOString().slice(0, 10) ?? null,
    periods:
      value.frequency === PayrollFrequency.MONTHLY
        ? [{ startDay: 1, endDay: "LAST_DAY" as const }]
        : [
            { startDay: 1, endDay: value.firstCutoffDay! },
            {
              startDay: value.firstCutoffDay! + 1,
              endDay: "LAST_DAY" as const,
            },
          ],
  }
}

function payrollOperation(auth: AuthContext): ManagementOperation {
  return createManagementOperation(auth)
}

async function auditVersion(
  tx: Prisma.TransactionClient,
  operation: ManagementOperation,
  subjectType: "COMPENSATION" | "PAYROLL_CONFIGURATION",
  subjectId: string,
  previousVersionId: string | null,
  versionId: string,
  reason: string,
) {
  return writeWorkforceManagementChange(tx, operation, {
    action: WorkforceManagementAction.VERSION_CREATED,
    origin: WorkforceManagementOrigin.PAYROLL_MANAGEMENT,
    subjectType,
    subjectId,
    changedFields: ["previousVersionId", "versionId", "reason"],
    changes: { previousVersionId, versionId, reason },
  })
}

function asOfConditions(today: Date): Prisma.EmployeeCompensationWhereInput[] {
  return [
    {
      effectiveFrom: { lte: today },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
    },
    { effectiveFrom: { gt: today } },
  ]
}

export const payrollService = {
  async listCompensation(input: {
    page: number
    search: string
    departmentId: string
    payType: PayrollPayType | ""
    status: "CONFIGURED" | "NOT_CONFIGURED" | "FUTURE_REVISION" | ""
  }) {
    const today = manilaToday()
    const [current, future] = asOfConditions(today)
    const and: Prisma.EmployeeWhereInput[] = []
    if (input.departmentId) and.push({ departmentId: input.departmentId })
    if (input.payType) {
      const currentPayType = { ...current, payType: input.payType }
      const futurePayType = { ...future, payType: input.payType }
      and.push({
        OR: [
          { compensations: { some: currentPayType } },
          { compensations: { none: current, some: futurePayType } },
        ],
      })
    }
    if (input.status === "CONFIGURED")
      and.push({ compensations: { some: current } })
    if (input.status === "NOT_CONFIGURED")
      and.push({ compensations: { none: { OR: [current, future] } } })
    if (input.status === "FUTURE_REVISION")
      and.push({
        AND: [
          { compensations: { none: current } },
          { compensations: { some: future } },
        ],
      })

    const where: Prisma.EmployeeWhereInput = {
      ...insensitive<Prisma.EmployeeWhereInput>(input.search, [
        "fullName",
        "employeeId",
      ]),
      ...(and.length ? { AND: and } : {}),
    }
    const page = await paginate(input.page, {
      rows: (db, window) =>
        db.employee.findMany({
          where,
          orderBy: [{ fullName: "asc" }, { id: "asc" }],
          ...window,
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            employmentType: true,
            status: true,
            department: { select: { id: true, name: true } },
            compensations: {
              where: { OR: [current, future] },
              orderBy: { effectiveFrom: "asc" },
              take: 2,
              select: compensationSelect,
            },
          },
        }),
      count: (db) => db.employee.count({ where }),
    })
    return {
      ...page,
      rows: page.rows.map((employee) => {
        const currentVersion = employee.compensations.find((value) =>
          isCurrent(value, today),
        )
        const futureVersion = employee.compensations.find(
          (value) => value.effectiveFrom > today,
        )
        const selected = currentVersion ?? futureVersion ?? null
        return {
          employee: {
            id: employee.id,
            employeeId: employee.employeeId,
            fullName: employee.fullName,
            employmentType: employee.employmentType,
            status: employee.status,
            department: employee.department,
          },
          compensation: selected ? mapCompensation(selected) : null,
          configurationStatus: currentVersion
            ? "CONFIGURED"
            : futureVersion
              ? "FUTURE_REVISION"
              : "NOT_CONFIGURED",
        }
      }),
    }
  },

  async getEmployeeCompensation(employeeId: string) {
    const prisma = getPrisma()!
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        employmentType: true,
        status: true,
        startDate: true,
        department: { select: { id: true, name: true } },
      },
    })
    if (!employee) fail(404, "Employee not found")
    const versions = await prisma.employeeCompensation.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: "desc" },
      select: compensationSelect,
    })
    const today = manilaToday()
    const current = versions.find((value) => isCurrent(value, today)) ?? null
    const future =
      [...versions]
        .filter((value) => value.effectiveFrom > today)
        .sort(
          (left, right) =>
            left.effectiveFrom.getTime() - right.effectiveFrom.getTime(),
        )[0] ?? null
    return {
      employee: {
        ...employee,
        startDate: employee.startDate?.toISOString().slice(0, 10) ?? null,
      },
      current: current ? mapCompensation(current) : null,
      future: future ? mapCompensation(future) : null,
    }
  },

  async getCompensationHistory(employeeId: string) {
    const prisma = getPrisma()!
    if (
      !(await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true },
      }))
    )
      fail(404, "Employee not found")
    const rows = await prisma.employeeCompensation.findMany({
      where: { employeeId },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: compensationSelect,
    })
    return { rows: rows.map(mapCompensation) }
  },

  async createCompensationVersion(
    auth: AuthContext,
    employeeId: string,
    input: CompensationVersionInput,
  ) {
    const prisma = getPrisma()!
    const operation = payrollOperation(auth)
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(848221, hashtext(${employeeId}))`
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, status: true },
      })
      if (!employee) fail(404, "Employee not found")
      if (employee.status === EmployeeStatus.INACTIVE)
        fail(409, "Compensation cannot be configured for an inactive employee")
      const previous = await tx.employeeCompensation.findFirst({
        where: { employeeId },
        orderBy: { effectiveFrom: "desc" },
        select: { id: true, effectiveFrom: true },
      })
      if (previous && input.effectiveFrom <= previous.effectiveFrom)
        fail(409, "A compensation version already exists on or after this date")
      if (previous)
        await tx.employeeCompensation.update({
          where: { id: previous.id },
          data: { effectiveTo: daysBefore(input.effectiveFrom) },
        })
      const created = await tx.employeeCompensation.create({
        data: {
          employeeId,
          payType: input.payType,
          baseRate: input.baseRate,
          currency: input.currency,
          effectiveFrom: input.effectiveFrom,
          createdById: auth.user.id,
          changeReason: input.changeReason,
          components: {
            create: input.components.map((component) => ({
              ...component,
              calculationType: "FIXED",
            })),
          },
        },
        select: compensationSelect,
      })
      await auditVersion(
        tx,
        operation,
        WorkforceManagementSubject.COMPENSATION,
        employeeId,
        previous?.id ?? null,
        created.id,
        input.changeReason,
      )
      return { compensation: mapCompensation(created) }
    })
  },

  async getPayrollSettings() {
    const prisma = getPrisma()!
    const rows = await prisma.payrollConfiguration.findMany({
      orderBy: { effectiveFrom: "desc" },
      select: configurationSelect,
    })
    const today = manilaToday()
    const current = rows.find((value) => isCurrent(value, today)) ?? null
    const future =
      [...rows]
        .filter((value) => value.effectiveFrom > today)
        .sort(
          (left, right) =>
            left.effectiveFrom.getTime() - right.effectiveFrom.getTime(),
        )[0] ?? null
    return {
      current: current ? mapConfiguration(current) : null,
      future: future ? mapConfiguration(future) : null,
    }
  },

  async getPayrollSettingsHistory() {
    const prisma = getPrisma()!
    const rows = await prisma.payrollConfiguration.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: configurationSelect,
    })
    return { rows: rows.map(mapConfiguration) }
  },

  async createPayrollConfiguration(
    auth: AuthContext,
    input: PayrollConfigurationInput,
  ) {
    const prisma = getPrisma()!
    const operation = payrollOperation(auth)
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(848222, 1)`
      const previous = await tx.payrollConfiguration.findFirst({
        orderBy: { effectiveFrom: "desc" },
        select: { id: true, effectiveFrom: true },
      })
      if (
        input.expectedLatestId !== undefined &&
        input.expectedLatestId !== (previous?.id ?? null)
      )
        fail(
          409,
          "Payroll schedule changed. Reload Settings before adding another schedule.",
        )
      if (previous && input.effectiveFrom <= previous.effectiveFrom)
        fail(409, "A payroll schedule already exists on or after this date")
      if (
        await tx.payrollPeriod.findFirst({
          where: { endDate: { gte: input.effectiveFrom } },
          select: { id: true },
        })
      )
        fail(
          409,
          "The new schedule would change already-generated payroll periods",
        )
      if (previous)
        await tx.payrollConfiguration.update({
          where: { id: previous.id },
          data: { effectiveTo: daysBefore(input.effectiveFrom) },
        })
      const created = await tx.payrollConfiguration.create({
        data: {
          frequency: input.frequency,
          firstCutoffDay: input.firstCutoffDay,
          currency: input.currency,
          effectiveFrom: input.effectiveFrom,
          changeReason: input.changeReason,
          createdById: auth.user.id,
        },
        select: configurationSelect,
      })
      await auditVersion(
        tx,
        operation,
        WorkforceManagementSubject.PAYROLL_CONFIGURATION,
        created.id,
        previous?.id ?? null,
        created.id,
        input.changeReason,
      )
      return { configuration: mapConfiguration(created) }
    })
  },
}
