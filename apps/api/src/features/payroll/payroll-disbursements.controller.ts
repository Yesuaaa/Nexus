import { payMongoDisbursements } from "./paymongo-disbursements.js"
import { randomInt } from "node:crypto"
import { Router } from "express"
import {
  Prisma,
  PayrollSandboxDestinationKind,
  PayrollSimulationOutcome,
  PayrollDisbursementStatus,
} from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { createManagementOperation } from "../../shared/management-history.js"
import {
  containsText,
  insensitive,
  paginate,
  parsePage,
} from "../../shared/query/pagination.js"
import { isRecordId, isUuidV4, recordIdParam } from "../../shared/validation.js"
import { requirePermission } from "../auth/auth.middleware.js"
import { Permission } from "../auth/auth.permissions.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"
import { approvedRevision } from "./payroll-documents.controller.js"
import { isPayrollSimulatorEnabled as simulatorEnabled } from "./payroll-simulator.js"

export const disbursementsRouter = Router()
const read = requirePermission(Permission.PAYROLL_READ)
const manage = requirePermission(Permission.PAYROLL_MANAGE)
const db = () => getPrisma()!
const include = {
  calculation: {
    include: {
      run: {
        include: {
          period: {
            include: { configuration: { select: { frequency: true } } },
          },
        },
      },
    },
  },
  items: {
    include: {
      payrollItem: { select: { employeeId: true, employeeNameSnapshot: true } },
      destination: { select: { id: true, kind: true, lastFour: true } },
      attempt: { select: { id: true, outcome: true, createdAt: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.PayrollDisbursementBatchInclude

const batchMetaInclude = {
  calculation: {
    include: {
      run: {
        include: {
          period: {
            include: { configuration: { select: { frequency: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.PayrollDisbursementBatchInclude

const payoutItemInclude = {
  payrollItem: {
    select: {
      employeeId: true,
      employeeNameSnapshot: true,
      employeeNumberSnapshot: true,
      employee: { select: { email: true, employeeId: true } },
    },
  },
  destination: { select: { id: true, kind: true, lastFour: true } },
  attempt: { select: { id: true, outcome: true, createdAt: true } },
} satisfies Prisma.PayrollDisbursementItemInclude

type Batch = Prisma.PayrollDisbursementBatchGetPayload<{
  include: typeof include
}>
function view(batch: Batch, detail = false) {
  const { calculation, items: persisted, ...record } = batch
  const items = persisted.map(
    ({ id, amount, payrollItem, destination, attempt }) => ({
      id,
      employeeId: payrollItem.employeeId,
      employeeNameSnapshot: payrollItem.employeeNameSnapshot,
      approvedNet: amount.toFixed(2),
      amount: amount.toFixed(2),
      destination: destination
        ? { kind: destination.kind, masked: "•••• " + destination.lastFour }
        : null,
      attempt,
      status: amount.isZero() ? "NO_PAYMENT" : "BLOCKED",
      reason: amount.isZero()
        ? "Zero net pay"
        : destination
          ? "Generated test destination does not enable production payout eligibility"
          : "No verified production payout destination",
    }),
  )
  return {
    ...record,
    runId: calculation.runId,
    revision: calculation.revision,
    period: calculation.run.period.cutoffLabel,
    frequency: calculation.run.period.configuration.frequency,
    employeeCount: items.length,
    blockedCount: items.filter((item) => item.status === "BLOCKED").length,
    totalNet: persisted
      .reduce((total, item) => total.plus(item.amount), new Prisma.Decimal(0))
      .toFixed(2),
    proposedAmount: "0.00",
    ...(detail
      ? {
          items,
          simulatorEnabled: simulatorEnabled(),
          provider: payMongoDisbursements,
        }
      : {}),
  }
}

function payoutItemView(
  value: Prisma.PayrollDisbursementItemGetPayload<{
    include: typeof payoutItemInclude
  }>,
) {
  const { id, amount, payrollItem, destination, attempt } = value
  return {
    id,
    employeeId: payrollItem.employeeId,
    employeeNameSnapshot: payrollItem.employeeNameSnapshot,
    employeeNumberSnapshot: payrollItem.employeeNumberSnapshot,
    employeeEmail: payrollItem.employee.email,
    approvedNet: amount.toFixed(2),
    amount: amount.toFixed(2),
    destination: destination
      ? { kind: destination.kind, masked: "•••• " + destination.lastFour }
      : null,
    attempt,
    status: amount.isZero() ? "NO_PAYMENT" : (attempt?.outcome ?? "BLOCKED"),
    reason: amount.isZero()
      ? "Zero net pay"
      : attempt
        ? `Sandbox ${attempt.outcome.toLowerCase()} simulation`
        : destination
          ? "Generated test destination does not enable production payout eligibility"
          : "No verified production payout destination",
  }
}

function parsePayoutPageSize(value: unknown) {
  if (value === undefined) return 10
  if (typeof value !== "string" || !/^(10|20|50)$/.test(value)) return null
  return Number(value)
}

const payoutSortValues = [
  "NAME_ASC",
  "NAME_DESC",
  "NET_ASC",
  "NET_DESC",
] as const
type PayoutSort = (typeof payoutSortValues)[number]

function parsePayoutSort(value: unknown): PayoutSort | null {
  if (value === undefined || value === "") return "NAME_ASC"
  return typeof value === "string" &&
    (payoutSortValues as readonly string[]).includes(value)
    ? (value as PayoutSort)
    : null
}

disbursementsRouter.use("/disbursements", (_req, res, next) => {
  res.set("Cache-Control", "private, no-store")
  next()
})
disbursementsRouter.param("id", recordIdParam("Invalid disbursement reference"))

disbursementsRouter.get("/disbursements", read, async (req, res) => {
  const page = parsePage(req.query.page)
  if (page === null) fail(400, "Invalid page")
  const status = req.query.status as PayrollDisbursementStatus | undefined
  if (status && !Object.values(PayrollDisbursementStatus).includes(status))
    fail(400, "Invalid status")
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : ""
  const where: Prisma.PayrollDisbursementBatchWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { id: containsText(search) },
            {
              calculation: {
                run: {
                  period: {
                    cutoffLabel: containsText(search),
                  },
                },
              },
            },
          ],
        }
      : {}),
  }
  const result = await paginate(page, {
    rows: (tx, window) =>
      tx.payrollDisbursementBatch.findMany({
        where,
        include,
        ...window,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    count: (tx) => tx.payrollDisbursementBatch.count({ where }),
  })
  res.json({ ...result, rows: result.rows.map((batch) => view(batch)) })
})

disbursementsRouter.get("/disbursements/:id", read, async (req, res) => {
  const batch = await db().payrollDisbursementBatch.findUnique({
    where: { id: String(req.params.id) },
    include: batchMetaInclude,
  })
  if (!batch) fail(404, "Disbursement batch not found")
  const page = parsePage(req.query.page)
  const pageSize = parsePayoutPageSize(req.query.pageSize)
  const sort = parsePayoutSort(req.query.sort)
  if (page === null) fail(400, "Invalid payout page")
  if (pageSize === null) fail(400, "Invalid payout page size")
  if (sort === null) fail(400, "Invalid payout sort")
  const search =
    typeof req.query.search === "string"
      ? req.query.search.trim().slice(0, 100)
      : ""
  const status = typeof req.query.status === "string" ? req.query.status : ""
  const statusWhere: Record<string, Prisma.PayrollDisbursementItemWhereInput> =
    {
      NO_PAYMENT: { amount: 0 },
      BLOCKED: { amount: { gt: 0 }, attempt: { is: null } },
      SUCCEEDED: { attempt: { is: { outcome: "SUCCEEDED" } } },
      FAILED: { attempt: { is: { outcome: "FAILED" } } },
      PENDING: { attempt: { is: { outcome: "PENDING" } } },
    }
  if (status && !statusWhere[status]) fail(400, "Invalid payout status")
  const where: Prisma.PayrollDisbursementItemWhereInput = {
    batchId: batch.id,
    ...insensitive<Prisma.PayrollDisbursementItemWhereInput>(search, [
      (filter) => ({ payrollItem: { employeeNameSnapshot: filter } }),
      (filter) => ({ payrollItem: { employeeNumberSnapshot: filter } }),
      (filter) => ({ payrollItem: { employee: { employeeId: filter } } }),
      (filter) => ({ payrollItem: { employee: { email: filter } } }),
    ]),
    ...(status ? statusWhere[status] : {}),
  }
  const orderBy =
    sort === "NET_ASC"
      ? [{ amount: "asc" as const }, { id: "asc" as const }]
      : sort === "NET_DESC"
        ? [{ amount: "desc" as const }, { id: "asc" as const }]
        : sort === "NAME_DESC"
          ? [
              { payrollItem: { employeeNameSnapshot: "desc" as const } },
              { id: "asc" as const },
            ]
          : [
              { payrollItem: { employeeNameSnapshot: "asc" as const } },
              { id: "asc" as const },
            ]
  const history = await db().workforceManagementChange.findMany({
    where: {
      subjectType: "PAYROLL_RUN",
      subjectId: batch.calculation.runId,
      action: "PAYROLL_DOCUMENT_ACTIVITY",
      changes: { path: ["batchId"], equals: batch.id },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, changes: true, createdAt: true, actorAccountId: true },
  })
  const actorIds = [...new Set(history.map((entry) => entry.actorAccountId))]
  const actors = actorIds.length
    ? await db().user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true, email: true },
      })
    : []
  const actorNames = new Map(
    actors.map((actor) => [
      actor.id,
      actor.fullName?.trim() || actor.email || actor.id,
    ]),
  )
  const historyWithActorNames = history.map((entry) => ({
    ...entry,
    actorName: actorNames.get(entry.actorAccountId) ?? entry.actorAccountId,
  }))
  const [itemsPage, employeeCount, blockedCount, total] = await Promise.all([
    paginate(
      page,
      {
        rows: (tx, window) =>
          tx.payrollDisbursementItem.findMany({
            where,
            include: payoutItemInclude,
            orderBy,
            ...window,
          }),
        count: (tx) => tx.payrollDisbursementItem.count({ where }),
      },
      { pageSize },
    ),
    db().payrollDisbursementItem.count({ where: { batchId: batch.id } }),
    db().payrollDisbursementItem.count({
      where: { batchId: batch.id, amount: { gt: 0 } },
    }),
    db().payrollDisbursementItem.aggregate({
      where: { batchId: batch.id },
      _sum: { amount: true },
    }),
  ])
  const { calculation, ...record } = batch
  res.json({
    ...record,
    runId: calculation.runId,
    revision: calculation.revision,
    period: calculation.run.period.cutoffLabel,
    frequency: calculation.run.period.configuration.frequency,
    employeeCount,
    blockedCount,
    totalNet: total._sum.amount?.toFixed(2) ?? "0.00",
    proposedAmount: "0.00",
    items: itemsPage.rows.map(payoutItemView),
    itemsPage: {
      ...itemsPage,
      sort,
      search,
      status,
    },
    simulatorEnabled: simulatorEnabled(),
    provider: payMongoDisbursements,
    history: historyWithActorNames,
  })
})

disbursementsRouter.post("/disbursements", manage, async (req, res) => {
  const runId: unknown = req.body?.runId
  if (!isRecordId(runId)) fail(400, "Invalid payroll run reference")
  const auth = req.auth!
  const batch = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848227, hashtext(${runId}))`
    const { revision } = await approvedRevision(tx, runId)
    const existing = await tx.payrollDisbursementBatch.findUnique({
      where: { calculationId: revision.id },
      include,
    })
    if (existing) return existing
    if (
      revision.items.some(
        (item) =>
          item.status !== "CALCULATED" ||
          !item.netAmount ||
          item.netAmount.isNegative() ||
          item.currency.trim() !== "PHP",
      )
    )
      fail(409, "The approved snapshot contains invalid payout amounts")
    const created = await tx.payrollDisbursementBatch.create({
      data: {
        calculationId: revision.id,
        createdBy: auth.user.id,
        items: {
          create: revision.items.map((item) => ({
            payrollItemId: item.id,
            amount: item.netAmount!,
          })),
        },
      },
      include,
    })
    await writeWorkforceManagementChange(tx, createManagementOperation(auth), {
      action: "PAYROLL_DOCUMENT_ACTIVITY",
      subjectType: "PAYROLL_RUN",
      origin: "PAYROLL_MANAGEMENT",
      subjectId: runId,
      changedFields: [],
      changes: {
        activity: "DISBURSEMENT_PREPARED",
        calculationId: revision.id,
        batchId: created.id,
      },
    })
    return created
  })
  res.json(view(batch))
})

for (const action of ["validate", "cancel"] as const) {
  disbursementsRouter.post(
    "/disbursements/:id/" + action,
    manage,
    async (req, res) => {
      const id = String(req.params.id)
      const auth = req.auth!
      const result = await db().$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(848228, hashtext(${id}))`
        const batch = await tx.payrollDisbursementBatch.findUnique({
          where: { id },
          include,
        })
        if (!batch) fail(404, "Disbursement batch not found")
        const status = action === "cancel" ? "CANCELLED" : "BLOCKED"
        if (batch.status === status) return batch
        if (batch.status === "CANCELLED") fail(409, "The batch was cancelled")
        const updated = await tx.payrollDisbursementBatch.update({
          where: { id },
          data: { status },
          include,
        })
        await writeWorkforceManagementChange(
          tx,
          createManagementOperation(auth),
          {
            action: "PAYROLL_DOCUMENT_ACTIVITY",
            subjectType: "PAYROLL_RUN",
            origin: "PAYROLL_MANAGEMENT",
            subjectId: batch.calculation.runId,
            changedFields: [],
            changes: {
              activity:
                action === "cancel"
                  ? "DISBURSEMENT_CANCELLED"
                  : "DISBURSEMENT_VALIDATED",
              calculationId: batch.calculationId,
              batchId: id,
            },
          },
        )
        return updated
      })
      res.json(view(result))
    },
  )
}

disbursementsRouter.param(
  "itemId",
  recordIdParam("Invalid payout item reference"),
)

for (const action of ["destination", "simulate"] as const) {
  disbursementsRouter.post(
    "/disbursements/:id/items/:itemId/" + action,
    manage,
    async (req, res) => {
      if (!simulatorEnabled()) fail(403, "Local payroll simulation is disabled")
      const id = String(req.params.id)
      const itemId = String(req.params.itemId)
      const auth = req.auth!
      const result = await db().$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(848228, hashtext(${id}))`
        const batch = await tx.payrollDisbursementBatch.findUnique({
          where: { id },
          include,
        })
        const item = batch?.items.find((entry) => entry.id === itemId)
        if (!batch || !item) fail(404, "Payout item not found")
        if (item.amount.isZero())
          fail(409, "Zero net pay does not require a payout")
        if (action === "destination") {
          const kind = req.body?.kind as PayrollSandboxDestinationKind
          if (!Object.values(PayrollSandboxDestinationKind).includes(kind))
            fail(400, "Select a test destination type")
          if (item.destination?.kind === kind) return view(batch, true)
          if (batch.status === "CANCELLED" || item.destination)
            fail(409, "This destination cannot be replaced")
          await tx.payrollSandboxDestination.create({
            data: {
              itemId,
              kind,
              lastFour: String(randomInt(10000)).padStart(4, "0"),
              createdBy: auth.user.id,
            },
          })
        } else {
          const outcome = req.body?.outcome as PayrollSimulationOutcome
          const key: unknown = req.body?.idempotencyKey
          if (!Object.values(PayrollSimulationOutcome).includes(outcome))
            fail(400, "Select a simulation outcome")
          if (!isUuidV4(key)) fail(400, "A UUID v4 idempotency key is required")
          const idempotencyKey = key.toLowerCase()
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(848229, hashtext(${idempotencyKey}))`
          const existing = await tx.payrollTransferAttempt.findUnique({
            where: { idempotencyKey },
          })
          if (existing) {
            if (existing.itemId !== itemId || existing.outcome !== outcome)
              fail(409, "The idempotency key belongs to a different simulation")
            return view(batch, true)
          }
          if (batch.status === "CANCELLED" || item.attempt || !item.destination)
            fail(409, "This item cannot be simulated")
          await tx.payrollTransferAttempt.create({
            data: { itemId, idempotencyKey, outcome, createdBy: auth.user.id },
          })
        }
        await writeWorkforceManagementChange(
          tx,
          createManagementOperation(auth),
          {
            action: "PAYROLL_DOCUMENT_ACTIVITY",
            subjectType: "PAYROLL_RUN",
            origin: "PAYROLL_MANAGEMENT",
            subjectId: batch.calculation.runId,
            changedFields: [],
            changes: {
              activity:
                action === "destination"
                  ? "DISBURSEMENT_TEST_DESTINATION"
                  : "DISBURSEMENT_SIMULATED",
              calculationId: batch.calculationId,
              batchId: id,
            },
          },
        )
        return view(
          await tx.payrollDisbursementBatch.findUniqueOrThrow({
            where: { id },
            include,
          }),
          true,
        )
      })
      res.json(result)
    },
  )
}
