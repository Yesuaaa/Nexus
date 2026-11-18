import { isRecordId, isUuidV4 } from "../../shared/validation.js"
import { createManagementOperation } from "../../shared/management-history.js"
import { writeWorkforceManagementChange } from "../employees/workforce-management-history.js"
import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { fail } from "../../shared/http-error.js"
import { PAGE_SIZE, pageWindow } from "../../shared/query/pagination.js"
import { approvedRevision } from "./payroll-documents.controller.js"

const zero = new Prisma.Decimal(0)
type Amount = Prisma.Decimal

type Obligation = {
  id: string
  amount: Amount
  employeeName?: string
  employeeNumber?: string
}
type Payout = {
  id: string
  payrollItemId: string
  batchId: string
  amount: Amount
  attempt: {
    id: string
    outcome: "SUCCEEDED" | "FAILED" | "PENDING"
    createdAt: Date
  } | null
}

export function evaluateReconciliation(
  obligations: Obligation[],
  payouts: Payout[],
  batchId: string | undefined,
) {
  const obligationIds = new Set(obligations.map(({ id }) => id))
  const byObligation = new Map<string, Payout>()
  const exceptions = []
  for (const payout of payouts) {
    if (
      payout.batchId !== batchId ||
      !obligationIds.has(payout.payrollItemId)
    ) {
      exceptions.push({
        category: "UNMATCHED_PAYOUT",
        subjectId: payout.id,
        payrollItemId: payout.payrollItemId,
        payoutId: payout.id,
        batchId: payout.batchId,
        attemptId: payout.attempt?.id ?? null,
        expected: null,
        observed: payout.amount.toFixed(2),
      })
    } else {
      byObligation.set(payout.payrollItemId, payout)
    }
  }

  let verifiedCount = 0
  const totals = {
    approved: zero,
    allocated: zero,
    simulatedConfirmed: zero,
    pending: zero,
    failed: zero,
    unresolved: zero,
  }
  const rows = obligations.map(
    ({ id, amount, employeeName, employeeNumber }) => {
      const payout = byObligation.get(id)
      const attempt = payout?.attempt
      const allocated = payout?.amount ?? zero
      const confirmed = attempt?.outcome === "SUCCEEDED" ? allocated : zero
      const pending = attempt?.outcome === "PENDING" ? allocated : zero
      const failed = attempt?.outcome === "FAILED" ? allocated : zero
      const unresolved = Prisma.Decimal.max(zero, amount.minus(confirmed))
      const category =
        batchId && !payout && amount.gt(0)
          ? "MISSING_PAYOUT_RECORD"
          : attempt?.outcome === "FAILED"
            ? "FAILED_PAYOUT"
            : attempt?.outcome === "SUCCEEDED" && !confirmed.eq(amount)
              ? "AMOUNT_MISMATCH"
              : null
      if (category) {
        exceptions.push({
          category,
          subjectId: id,
          payrollItemId: id,
          payoutId: payout?.id ?? null,
          batchId: batchId ?? null,
          attemptId: attempt?.id ?? null,
          expected: amount.toFixed(2),
          observed: payout ? allocated.toFixed(2) : null,
        })
      }
      const matched = !category && (amount.isZero() || confirmed.eq(amount))
      if (matched && amount.gt(0)) verifiedCount++
      totals.approved = totals.approved.plus(amount)
      totals.allocated = totals.allocated.plus(allocated)
      totals.simulatedConfirmed = totals.simulatedConfirmed.plus(confirmed)
      totals.pending = totals.pending.plus(pending)
      totals.failed = totals.failed.plus(failed)
      totals.unresolved = totals.unresolved.plus(unresolved)
      return {
        payrollItemId: id,
        employeeName,
        employeeNumber,
        payoutId: payout?.id ?? null,
        attempt: attempt ? { ...attempt, source: "LOCAL_SIMULATOR" } : null,
        status: category
          ? "EXCEPTION"
          : matched
            ? "MATCHED"
            : batchId
              ? "PENDING"
              : "NOT_STARTED",
        amounts: {
          approved: amount.toFixed(2),
          allocated: allocated.toFixed(2),
          realPaid: "0.00",
          simulatedConfirmed: confirmed.toFixed(2),
          pending: pending.toFixed(2),
          failed: failed.toFixed(2),
          unresolved: unresolved.toFixed(2),
        },
      }
    },
  )
  return {
    status: exceptions.length
      ? "EXCEPTION"
      : rows.every((row) => row.status === "MATCHED")
        ? "MATCHED"
        : verifiedCount
          ? "PARTIALLY_MATCHED"
          : batchId
            ? "PENDING"
            : "NOT_STARTED",
    currency: "PHP",
    amounts: {
      approved: totals.approved.toFixed(2),
      allocated: totals.allocated.toFixed(2),
      realPaid: "0.00",
      simulatedConfirmed: totals.simulatedConfirmed.toFixed(2),
      pending: totals.pending.toFixed(2),
      failed: totals.failed.toFixed(2),
      unresolved: totals.unresolved.toFixed(2),
    },
    rows,
    exceptions,
  }
}

async function evaluateRun(tx: Prisma.TransactionClient, runId: string) {
  const { run, revision } = await approvedRevision(tx, runId)
  const approval = await tx.payrollApprovalEvent.findUniqueOrThrow({
    where: {
      calculationId_action: {
        calculationId: revision.id,
        action: "PAYROLL_APPROVED",
      },
    },
    select: { id: true, createdAt: true },
  })
  const batch = await tx.payrollDisbursementBatch.findUnique({
    where: { calculationId: revision.id },
    select: { id: true, status: true, createdAt: true },
  })
  const obligations = revision.items.map((item) => {
    if (
      item.status !== "CALCULATED" ||
      !item.netAmount ||
      item.netAmount.isNegative() ||
      item.currency.trim() !== "PHP"
    )
      fail(409, "The approved snapshot contains invalid payable amounts")
    return {
      id: item.id,
      amount: item.netAmount,
      employeeName: item.employeeNameSnapshot,
      employeeNumber: item.employeeNumberSnapshot,
    }
  })
  obligations.sort((first, second) => first.id.localeCompare(second.id))
  const payouts = await tx.payrollDisbursementItem.findMany({
    where: {
      OR: [
        ...(batch ? [{ batchId: batch.id }] : []),
        { payrollItem: { calculationId: revision.id } },
      ],
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      batchId: true,
      payrollItemId: true,
      amount: true,
      attempt: { select: { id: true, outcome: true, createdAt: true } },
    },
  })
  return {
    runId,
    period: run.period.cutoffLabel,
    calculationId: revision.id,
    revision: revision.revision,
    approval,
    batch,
    ...evaluateReconciliation(obligations, payouts, batch?.id),
  }
}

export async function readReconciliation(
  runId: string,
  page: number,
  exceptionPage: number,
  filters = { search: "", payoutStatus: "", category: "", observation: "" },
) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const { rows, exceptions, ...summary } = await evaluateRun(tx, runId)
      const history = await tx.payrollReconciliationException.findMany({
        where: { calculationId: summary.calculationId },
        orderBy: [
          { lastObservedAt: "desc" },
          { category: "asc" },
          { subjectId: "asc" },
        ],
        select: {
          category: true,
          subjectId: true,
          status: true,
          version: true,
          observed: true,
          lastEvidence: true,
          firstDetectedAt: true,
          lastObservedAt: true,
        },
      })
      const key = exceptionKey
      const currentKeys = new Set(exceptions.map(key))
      const historyByKey = new Map(history.map((entry) => [key(entry), entry]))
      const employeeById = new Map(rows.map((row) => [row.payrollItemId, row]))
      const withLabel = (entry: (typeof exceptions)[number]) => {
        const employee = employeeById.get(entry.payrollItemId)
        const difference =
          entry.expected !== null && entry.observed !== null
            ? new Prisma.Decimal(entry.observed)
                .minus(entry.expected)
                .toFixed(2)
            : null
        return {
          category: entry.category,
          subjectId: entry.subjectId,
          payrollItemId: entry.payrollItemId,
          payoutId: entry.payoutId,
          batchId: entry.batchId,
          attemptId: entry.attemptId,
          expected: entry.expected,
          observed: entry.observed,
          difference,
          employeeName: employee?.employeeName,
          employeeNumber: employee?.employeeNumber,
        }
      }
      const current = exceptions.map((entry) => {
        const stored = historyByKey.get(key(entry))
        const recurring = Boolean(stored && startsReviewCycle(stored, entry))
        return {
          ...withLabel(entry),
          observation: "CURRENT",
          lifecycle: recurring ? "OPEN" : (stored?.status ?? null),
          version:
            stored?.observed && sameEvidence(stored.lastEvidence, entry)
              ? stored.version
              : null,
          recurring,
          firstDetectedAt: stored?.firstDetectedAt ?? null,
          lastObservedAt: stored?.lastObservedAt ?? null,
        }
      })
      const historical = history
        .filter((entry) => !currentKeys.has(key(entry)))
        .map((entry) => ({
          ...withLabel(entry.lastEvidence as (typeof exceptions)[number]),
          observation: "HISTORICAL",
          lifecycle: entry.status,
          version: entry.observed ? null : entry.version,
          recurring: false,
          firstDetectedAt: entry.firstDetectedAt,
          lastObservedAt: entry.lastObservedAt,
        }))
      const searchable = (...values: (string | undefined)[]) =>
        values.some((value) =>
          value?.toLowerCase().includes(filters.search.toLowerCase()),
        )
      const matchingExceptions = [...current, ...historical].filter(
        (entry) =>
          (!filters.category || entry.category === filters.category) &&
          (!filters.observation || entry.observation === filters.observation),
      )
      const currentByEmployee = new Map<string, typeof current>()
      for (const entry of current) {
        const existing = currentByEmployee.get(entry.payrollItemId) ?? []
        existing.push(entry)
        currentByEmployee.set(entry.payrollItemId, existing)
      }
      const matchingRows = rows.filter(
        (row) =>
          searchable(row.employeeName, row.employeeNumber, row.payrollItemId) &&
          (!filters.payoutStatus ||
            (row.attempt?.outcome ?? row.status) === filters.payoutStatus),
      )
      const pageItems = pageWindow(page)
      const pageExceptions = pageWindow(exceptionPage)
      return {
        ...summary,
        employees: {
          rows: matchingRows
            .slice(pageItems.skip, pageItems.skip + pageItems.take)
            .map((row) => ({
              ...row,
              discrepancies: currentByEmployee.get(row.payrollItemId) ?? [],
            })),
          total: matchingRows.length,
          page,
          pageSize: PAGE_SIZE,
        },
        exceptions: {
          rows: matchingExceptions.slice(
            pageExceptions.skip,
            pageExceptions.skip + pageExceptions.take,
          ),
          total: matchingExceptions.length,
          page: exceptionPage,
          pageSize: PAGE_SIZE,
        },
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function recordReconciliationExceptions(
  runId: string,
  operation?: ReturnType<typeof createManagementOperation>,
) {
  return getPrisma()!.$transaction(async (tx) => {
    await lockReconciliation(tx, runId)
    const result = await evaluateRun(tx, runId)
    const observedAt = new Date()
    const stored = await tx.payrollReconciliationException.findMany({
      where: { calculationId: result.calculationId },
    })
    const byIdentity = new Map(
      stored.map((entry) => [exceptionKey(entry), entry]),
    )
    const detected = new Set(result.exceptions.map(exceptionKey))
    for (const entry of stored) {
      if (entry.observed && !detected.has(exceptionKey(entry))) {
        const { calculationId, category, subjectId } = entry
        await tx.payrollReconciliationException.update({
          where: {
            calculationId_category_subjectId: {
              calculationId,
              category,
              subjectId,
            },
          },
          data: { observed: false, version: { increment: 1 } },
        })
      }
    }
    for (const exception of result.exceptions) {
      const identity = {
        calculationId: result.calculationId,
        category: exception.category,
        subjectId: exception.subjectId,
      }
      const prior = byIdentity.get(exceptionKey(exception))
      await tx.payrollReconciliationException.upsert({
        where: { calculationId_category_subjectId: identity },
        create: {
          ...identity,
          firstEvidence: exception,
          lastEvidence: exception,
          firstDetectedAt: observedAt,
          lastObservedAt: observedAt,
        },
        update: {
          lastEvidence: exception,
          lastObservedAt: observedAt,
          observed: true,
          ...(prior &&
          (!prior.observed || !sameEvidence(prior.lastEvidence, exception))
            ? { version: { increment: 1 } }
            : {}),
          ...(prior && startsReviewCycle(prior, exception)
            ? { status: "OPEN" }
            : {}),
        },
      })
    }
    if (operation) {
      await writeWorkforceManagementChange(tx, operation, {
        action: "PAYROLL_DOCUMENT_ACTIVITY",
        subjectType: "PAYROLL_RUN",
        origin: "PAYROLL_MANAGEMENT",
        subjectId: runId,
        changedFields: [],
        changes: {
          activity: "RECONCILIATION_OBSERVED",
          calculationId: result.calculationId,
        },
      })
    }
    return result.exceptions.length
  })
}

async function lockReconciliation(tx: Prisma.TransactionClient, runId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(848227, hashtext(${runId}))`
  const batch = await tx.payrollDisbursementBatch.findFirst({
    where: { calculation: { runId } },
    select: { id: true },
  })
  if (batch)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(848228, hashtext(${batch.id}))`
}

function exceptionKey(entry: { category: string; subjectId: string }) {
  return JSON.stringify([entry.category, entry.subjectId])
}

type Evidence = ReturnType<typeof evaluateReconciliation>["exceptions"][number]

function sameEvidence(stored: Prisma.JsonValue, current: Evidence) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored))
    return false
  return Object.entries(current).every(([key, value]) => stored[key] === value)
}

function startsReviewCycle(
  stored: { observed: boolean; status: string; lastEvidence: Prisma.JsonValue },
  current: Evidence,
) {
  return (
    !stored.observed ||
    ((stored.status === "RESOLVED" || stored.status === "DISMISSED") &&
      !sameEvidence(stored.lastEvidence, current))
  )
}

const transitions = {
  OPEN: {
    START_REVIEW: "UNDER_REVIEW",
    RESOLVE: "RESOLVED",
    DISMISS: "DISMISSED",
  },
  UNDER_REVIEW: {
    RETURN_TO_QUEUE: "OPEN",
    RESOLVE: "RESOLVED",
    DISMISS: "DISMISSED",
    ASSESS: "UNDER_REVIEW",
  },
  RESOLVED: { REOPEN: "UNDER_REVIEW" },
  DISMISSED: { REOPEN: "UNDER_REVIEW" },
} as const

const classifications: Record<string, readonly string[]> = {
  RESOLVE: ["INVESTIGATION_CONCLUDED", "FURTHER_ACTION_REQUIRED"],
  DISMISS: ["INVALID_OBSERVATION", "EXPECTED_CONDITION"],
}
const assessments = [
  "RETRY_REQUIRED",
  "PROVIDER_INVESTIGATION",
  "MANUAL_VERIFICATION",
  "INCORRECT_PAYOUT_INFORMATION",
  "AMOUNT_REVIEW",
  "NO_ACTION_REQUIRED",
]
const exceptionCategories = [
  "AMOUNT_MISMATCH",
  "MISSING_PAYOUT_RECORD",
  "FAILED_PAYOUT",
  "UNMATCHED_PAYOUT",
]

function decisionInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "Invalid exception decision")
  const {
    category,
    subjectId,
    action,
    requestId,
    reason: rawReason,
    version,
    classification = null,
    assessment = null,
  } = body as Record<string, unknown>
  const reason = typeof rawReason === "string" ? rawReason.trim() : ""
  if (
    typeof category !== "string" ||
    !exceptionCategories.includes(category) ||
    !isRecordId(subjectId) ||
    !isUuidV4(requestId) ||
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 0 ||
    typeof action !== "string" ||
    ![
      "START_REVIEW",
      "RETURN_TO_QUEUE",
      "RESOLVE",
      "DISMISS",
      "REOPEN",
      "ASSESS",
    ].includes(action) ||
    reason.length < 5 ||
    reason.length > 500 ||
    Array.from(reason).some((character) => {
      const code = character.charCodeAt(0)
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
    })
  )
    fail(
      400,
      "Provide a valid decision and a reason between 5 and 500 characters",
    )
  const allowed = classifications[action]
  if (
    allowed
      ? typeof classification !== "string" || !allowed.includes(classification)
      : classification !== null
  )
    fail(400, "Choose a valid decision classification")
  if (
    action === "ASSESS"
      ? typeof assessment !== "string" || !assessments.includes(assessment)
      : assessment !== null
  )
    fail(400, "Choose a valid corrective action assessment")
  return {
    category,
    subjectId,
    action,
    requestId,
    version,
    reason,
    classification: classification as string | null,
    assessment: assessment as string | null,
  }
}

function decisionWhere(
  calculationId: string,
  category: string,
  subjectId: string,
) {
  if (!exceptionCategories.includes(category) || !isRecordId(subjectId))
    fail(400, "Invalid exception reference")
  return { calculationId, category, subjectId }
}

const decisionSelect = {
  id: true,
  actorId: true,
  action: true,
  previous: true,
  next: true,
  reason: true,
  classification: true,
  assessment: true,
  createdAt: true,
  evidence: true,
} satisfies Prisma.PayrollReconciliationDecisionSelect

export async function readExceptionDecisions(
  runId: string,
  category: string,
  subjectId: string,
) {
  const db = getPrisma()!
  return db.$transaction(
    async (tx) => {
      const { revision } = await approvedRevision(tx, runId)
      const identity = decisionWhere(revision.id, category, subjectId)
      const exception = await tx.payrollReconciliationException.findUnique({
        where: { calculationId_category_subjectId: identity },
        select: {
          decisions: { select: decisionSelect, orderBy: { version: "asc" } },
        },
      })
      if (!exception) fail(404, "Recorded exception not found")
      const actors = await tx.user.findMany({
        where: {
          id: {
            in: [...new Set(exception.decisions.map(({ actorId }) => actorId))],
          },
        },
        select: { id: true, fullName: true },
      })
      const names = new Map(actors.map(({ id, fullName }) => [id, fullName]))
      return {
        decisions: exception.decisions.map(({ evidence, ...decision }) => {
          const refs = evidence as Evidence
          return {
            ...decision,
            actorName: names.get(decision.actorId) ?? null,
            batchId: refs.batchId,
            payoutId: refs.payoutId,
            attemptId: refs.attemptId,
          }
        }),
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}

export async function decideReconciliationException(
  runId: string,
  body: unknown,
  operation: ReturnType<typeof createManagementOperation>,
) {
  const input = decisionInput(body)
  return getPrisma()!.$transaction(async (tx) => {
    await lockReconciliation(tx, runId)
    const result = await evaluateRun(tx, runId)
    const { calculationId } = result
    const {
      category,
      subjectId,
      requestId,
      action,
      reason,
      classification,
      assessment,
    } = input
    const identity = decisionWhere(calculationId, category, subjectId)
    const stored = await tx.payrollReconciliationException.findUnique({
      where: { calculationId_category_subjectId: identity },
    })
    if (!stored)
      fail(404, "Record observations before reviewing this exception")
    const replay = await tx.payrollReconciliationDecision.findUnique({
      where: {
        calculationId_category_subjectId_requestId: { ...identity, requestId },
      },
    })
    if (replay) {
      if (
        replay.actorId !== operation.actorAccountId ||
        replay.version !== input.version + 1 ||
        replay.action !== action ||
        replay.reason !== reason ||
        replay.classification !== classification ||
        replay.assessment !== assessment
      )
        fail(409, "This decision request ID was already used")
      return { id: replay.id }
    }

    const current = result.exceptions.find(
      (entry) => exceptionKey(entry) === exceptionKey(identity),
    )
    if (stored.version !== input.version)
      fail(409, "This exception changed. Reload the evidence before deciding.")
    if (
      Boolean(current) !== stored.observed ||
      (current && !sameEvidence(stored.lastEvidence, current))
    )
      fail(
        409,
        "The payout evidence changed. Record observations and reload before deciding.",
      )
    const allowed: Partial<Record<string, typeof stored.status>> =
      transitions[stored.status]
    const next = allowed[action]
    if (!next)
      fail(409, "This decision is not available in the current review state")

    const evidence = stored.lastEvidence as Evidence
    if (action === "RESOLVE" || action === "DISMISS") {
      const revision = await tx.payrollRunCalculation.findUniqueOrThrow({
        where: { id: calculationId },
        select: { createdById: true, run: { select: { createdById: true } } },
      })
      const batch = evidence.batchId
        ? await tx.payrollDisbursementBatch.findUnique({
            where: { id: evidence.batchId },
            select: { createdBy: true },
          })
        : null
      const payout = evidence.payoutId
        ? await tx.payrollDisbursementItem.findUnique({
            where: { id: evidence.payoutId },
            select: {
              destination: { select: { createdBy: true } },
              attempt: { select: { createdBy: true } },
            },
          })
        : null
      const initiators = [
        revision.createdById,
        revision.run.createdById,
        batch?.createdBy,
        payout?.destination?.createdBy,
        payout?.attempt?.createdBy,
      ]
      if (
        category === "UNMATCHED_PAYOUT" ||
        (evidence.batchId && !batch) ||
        (evidence.payoutId && !payout) ||
        (evidence.attemptId && !payout?.attempt) ||
        initiators.includes(operation.actorAccountId)
      )
        fail(
          403,
          "An independent administrator with attributable evidence must finalize this exception",
        )
    }

    const decision = await tx.payrollReconciliationDecision.create({
      data: {
        ...identity,
        requestId,
        actorId: operation.actorAccountId,
        action,
        reason,
        classification,
        assessment,
        version: stored.version + 1,
        previous: stored.status,
        next,
        evidence: {
          ...evidence,
          observation: stored.observed ? "CURRENT" : "HISTORICAL",
        },
      },
      select: { id: true },
    })
    await tx.payrollReconciliationException.update({
      where: { calculationId_category_subjectId: identity },
      data: { status: next, version: { increment: 1 } },
    })
    await writeWorkforceManagementChange(tx, operation, {
      action: "PAYROLL_DOCUMENT_ACTIVITY",
      subjectType: "PAYROLL_RUN",
      origin: "PAYROLL_MANAGEMENT",
      subjectId: runId,
      changedFields: [],
      changes: {
        activity: "RECONCILIATION_DECIDED",
        calculationId,
        decisionId: decision.id,
      },
    })
    return decision
  })
}
