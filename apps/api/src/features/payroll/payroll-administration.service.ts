import { readPayrollPreferences } from "./payroll-preferences.js"
import {
  Role,
  type Prisma,
  WorkforceManagementSubject,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { paginate } from "../../shared/query/pagination.js"
import { hasPermission, Permission } from "../auth/auth.permissions.js"
import { payMongoDisbursements } from "./paymongo-disbursements.js"
import { manilaToday } from "./payroll.service.js"
import { validatePayrollConfiguration } from "./payroll.schema.js"
import { isPayrollSimulatorEnabled } from "./payroll-simulator.js"

const destinations = {
  compensation: "/module/payroll/compensation",
  approvals: "/module/payroll/approvals",
  payslips: "/module/payroll/payslips",
  disbursements: "/module/payroll/disbursements",
  reconciliation: "/module/payroll/reconciliation",
} as const

type Capability = {
  id: string
  label: string
  state: "READY" | "ATTENTION_REQUIRED" | "UNAVAILABLE" | "NOT_CONFIGURED"
  reason: string
  description: string
  target?: (typeof destinations)[keyof typeof destinations]
}

async function check(
  capability: Capability,
  evaluate: () => Promise<Partial<Capability>>,
) {
  try {
    return { ...capability, ...(await evaluate()) }
  } catch (cause) {
    console.error(
      "Payroll readiness probe failed",
      capability.id,
      cause instanceof Error ? cause.name : "UnknownError",
    )
    return {
      ...capability,
      state: "UNAVAILABLE" as const,
      reason: "DEPENDENCY_UNAVAILABLE",
      description: "The required payroll records could not be read.",
    }
  }
}

export async function readPayrollReadiness() {
  const db = getPrisma()!
  const today = manilaToday()
  const effective = {
    effectiveFrom: { lte: today },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
  }
  const capabilities = await Promise.all([
    check(
      {
        id: "calculation",
        label: "Payroll Calculation",
        state: "READY",
        reason: "CALCULATION_AVAILABLE",
        description:
          "An effective schedule is available. Each run still validates compensation and attendance.",
        target: destinations.compensation,
      },
      async () => {
        const schedules = await db.payrollConfiguration.findMany({
          where: effective,
          take: 2,
          select: {
            frequency: true,
            firstCutoffDay: true,
            currency: true,
            effectiveFrom: true,
            changeReason: true,
          },
        })
        const schedule = schedules[0]
        if (!schedule)
          return {
            state: "NOT_CONFIGURED",
            reason: "NO_EFFECTIVE_SCHEDULE",
            description:
              "Schedule a payroll configuration effective today or review the date of the next schedule.",
          }
        if (
          schedules.length > 1 ||
          "error" in
            validatePayrollConfiguration({
              ...schedule,
              currency: schedule.currency.trim(),
              effectiveFrom: schedule.effectiveFrom.toISOString().slice(0, 10),
            })
        )
          return {
            state: "ATTENTION_REQUIRED",
            reason: "INVALID_EFFECTIVE_SCHEDULE",
            description:
              "Review the effective schedule and cutoff rules on the Schedule tab.",
          }
        const activeEmployee = await db.employee.findFirst({
          where: { status: "ACTIVE" },
          select: { id: true },
        })
        if (activeEmployee) {
          const compensation = await db.employeeCompensation.findFirst({
            where: {
              ...effective,
              employee: { status: "ACTIVE" },
              currency: "PHP",
              baseRate: { gt: 0 },
            },
            select: { id: true },
          })
          if (!compensation)
            return {
              state: "ATTENTION_REQUIRED",
              reason: "NO_EFFECTIVE_COMPENSATION",
              description:
                "Active employees exist, but no valid effective compensation was found. Review Compensation.",
            }
        }
        return {}
      },
    ),
    check(
      {
        id: "approval",
        label: "Payroll Approval",
        state: "READY",
        reason: "APPROVAL_AVAILABLE",
        description:
          "The approval workflow is available. Each run requires an independent eligible administrator.",
        target: destinations.approvals,
      },
      async () => {
        await db.payrollApprovalEvent.findFirst({
          select: { id: true, calculationId: true, action: true },
        })
        return {}
      },
    ),
    check(
      {
        id: "publication",
        label: "Payslip Publication",
        state: "READY",
        reason: "PUBLICATION_AVAILABLE",
        description:
          "Publication is available after approval and generation of all required payslips for the run.",
        target: destinations.payslips,
      },
      async () => {
        await readPayrollPreferences(db)
        await db.payrollPayslip.findFirst({
          select: { id: true, publishedAt: true, itemId: true },
        })
        return {}
      },
    ),
    check(
      {
        id: "simulation",
        label: "Disbursement Simulation",
        state: "READY",
        reason: "SIMULATOR_ENABLED",
        description:
          "Local simulation is enabled. A prepared payout and generated test destination are required.",
        target: destinations.disbursements,
      },
      async () => {
        if (!isPayrollSimulatorEnabled())
          return {
            state: "UNAVAILABLE",
            reason: "SIMULATOR_DISABLED",
            description:
              "Local simulation requires development mode and explicit enablement.",
          }
        await db.payrollTransferAttempt.findFirst({
          select: { id: true, outcome: true },
        })
        await db.payrollSandboxDestination.findFirst({
          select: { id: true, kind: true },
        })
        return {}
      },
    ),
    check(
      {
        id: "reconciliation",
        label: "Reconciliation",
        state: "READY",
        reason: "RECONCILIATION_AVAILABLE",
        description:
          "Reconciliation records are readable. An approved revision is needed to evaluate a run.",
        target: destinations.reconciliation,
      },
      async () => {
        await db.payrollRunCalculation.findFirst({
          select: { id: true, netTotal: true },
        })
        await db.payrollDisbursementItem.findFirst({
          select: { id: true, amount: true },
        })
        await db.payrollReconciliationException.findFirst({
          select: { subjectId: true, version: true, observed: true },
        })
        await db.payrollReconciliationDecision.findFirst({
          select: { id: true, version: true },
        })
        return {}
      },
    ),
  ])
  capabilities.splice(4, 0, {
    id: "real-disbursement",
    label: "Real Disbursement",
    state: "UNAVAILABLE",
    reason: payMongoDisbursements.enabled
      ? "LIVE_EXECUTION_UNSUPPORTED"
      : "LIVE_EXECUTION_DISABLED",
    description:
      "Real transfers are intentionally unavailable. Simulator outcomes do not confirm payment.",
    target: destinations.disbursements,
  })
  return {
    capabilities,
    permissions: [Role.ADMIN, Role.SUPERADMIN, Role.STAFF, Role.USER].map(
      (role) => ({
        role,
        read: hasPermission(role, Permission.PAYROLL_READ),
        manage: hasPermission(role, Permission.PAYROLL_MANAGE),
      }),
    ),
  }
}

const subjects = [
  WorkforceManagementSubject.PAYROLL_CONFIGURATION,
  WorkforceManagementSubject.COMPENSATION,
  WorkforceManagementSubject.PAYROLL_PERIOD,
  WorkforceManagementSubject.PAYROLL_RUN,
] as const
const visibleActivities = new Set([
  "GENERATED",
  "REGENERATED",
  "PUBLISHED",
  "DISBURSEMENT_PREPARED",
  "DISBURSEMENT_VALIDATED",
  "DISBURSEMENT_CANCELLED",
  "DISBURSEMENT_TEST_DESTINATION",
  "DISBURSEMENT_SIMULATED",
  "RECONCILIATION_OBSERVED",
  "RECONCILIATION_DECIDED",
])

export async function readPayrollAudit(page: number, subject: unknown) {
  const filtered = subjects.find((value) => value === subject)
  if (subject !== undefined && !filtered)
    fail(400, "Choose a valid Payroll audit category")
  const where: Prisma.WorkforceManagementChangeWhereInput = {
    origin: "PAYROLL_MANAGEMENT",
    subjectType: { in: filtered ? [filtered] : [...subjects] },
  }
  return getPrisma()!.$transaction(
    async (tx) => {
      const result = await paginate(
        page,
        {
          rows: (db, window) =>
            db.workforceManagementChange.findMany({
              where,
              ...window,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                actorAccountId: true,
                actorRoleAtTime: true,
                subjectType: true,
                subjectId: true,
                action: true,
                changes: true,
                createdAt: true,
              },
            }),
          count: (db) => db.workforceManagementChange.count({ where }),
        },
        { tx },
      )
      const actors = await tx.user.findMany({
        where: {
          id: {
            in: [
              ...new Set(
                result.rows.map(({ actorAccountId }) => actorAccountId),
              ),
            ],
          },
        },
        select: { id: true, fullName: true },
      })
      const names = new Map(actors.map(({ id, fullName }) => [id, fullName]))
      return {
        ...result,
        rows: result.rows.map(({ actorAccountId, changes, ...row }) => {
          const activity =
            changes && typeof changes === "object" && !Array.isArray(changes)
              ? changes.activity
              : null
          return {
            ...row,
            actorName: names.get(actorAccountId) ?? actorAccountId,
            activity:
              typeof activity === "string" && visibleActivities.has(activity)
                ? activity
                : null,
          }
        }),
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}
