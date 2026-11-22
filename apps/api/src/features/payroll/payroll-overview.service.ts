import { fail } from "../../shared/http-error.js"
import { Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"
import { evaluateReconciliation } from "./payroll-reconciliation.service.js"

export async function readPayrollOverview(limit: number) {
  return getPrisma()!.$transaction(
    async (tx) => {
      const periods = await tx.payrollPeriod.findMany({
        take: limit,
        where: { run: { isNot: null } },
        orderBy: [{ startDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          cutoffLabel: true,
          startDate: true,
          endDate: true,
          run: {
            select: { id: true, status: true, calculationCount: true },
          },
        },
      })
      const approved = periods.flatMap(({ run }) =>
        run?.status === "APPROVED"
          ? [{ runId: run.id, revision: run.calculationCount }]
          : [],
      )
      const revisions = approved.length
        ? await tx.payrollRunCalculation.findMany({
            where: {
              OR: approved,
              status: "COMPLETE",
              approvalEvents: { some: { action: "PAYROLL_APPROVED" } },
              items: { some: {} },
            },
            select: {
              id: true,
              runId: true,
              grossTotal: true,
              deductionsTotal: true,
              netTotal: true,
              disbursement: { select: { id: true } },
              items: {
                select: {
                  id: true,
                  netAmount: true,
                  status: true,
                  currency: true,
                },
              },
            },
          })
        : []
      const batchIds = revisions.flatMap(({ disbursement }) =>
        disbursement ? [disbursement.id] : [],
      )
      const payouts = revisions.length
        ? await tx.payrollDisbursementItem.findMany({
            where: {
              OR: [
                { batchId: { in: batchIds } },
                {
                  payrollItem: {
                    calculationId: { in: revisions.map(({ id }) => id) },
                  },
                },
              ],
            },
            orderBy: { id: "asc" },
            select: {
              id: true,
              amount: true,
              batchId: true,
              payrollItemId: true,
              payrollItem: { select: { calculationId: true } },
              attempt: { select: { id: true, outcome: true, createdAt: true } },
            },
          })
        : []
      const byRevision = new Map<string, typeof payouts>()
      const revisionByBatch = new Map(
        revisions.flatMap(({ id, disbursement }) =>
          disbursement ? [[disbursement.id, id] as const] : [],
        ),
      )
      const payoutCounts = {
        SUCCEEDED: 0,
        PENDING: 0,
        FAILED: 0,
        BLOCKED: 0,
        NO_PAYMENT: 0,
      }
      for (const payout of payouts) {
        const batchRevision = revisionByBatch.get(payout.batchId)
        for (const id of new Set([
          payout.payrollItem.calculationId,
          batchRevision,
        ])) {
          if (!id) continue
          const list = byRevision.get(id) ?? []
          list.push(payout)
          byRevision.set(id, list)
        }
        if (batchRevision)
          payoutCounts[
            payout.amount.isZero()
              ? "NO_PAYMENT"
              : (payout.attempt?.outcome ?? "BLOCKED")
          ]++
      }
      const attention: {
        id: string
        runId: string
        period: string
        category: string
        status: string
        item: string
      }[] = []
      const counts = new Map<string, number>()
      const countedExceptions = new Set<string>()
      let pendingApprovals = 0
      let approvedNet = new Prisma.Decimal(0)
      const byRun = new Map(
        revisions.map((revision) => [revision.runId, revision]),
      )
      const trend = []
      for (const period of periods) {
        const run = period.run
        if (!run) continue
        if (run.status === "PENDING_APPROVAL") {
          pendingApprovals++
          if (attention.length < 10)
            attention.push({
              id: run.id,
              runId: run.id,
              period: period.cutoffLabel,
              category: "APPROVAL",
              status: run.status,
              item: "Payroll run awaiting approval",
            })
        }
        const revision = byRun.get(run.id)
        if (!revision) continue
        approvedNet = approvedNet.plus(revision.netTotal)
        trend.push({
          id: period.id,
          period: period.cutoffLabel,
          gross: revision.grossTotal.toFixed(2),
          deductions: revision.deductionsTotal.toFixed(2),
          net: revision.netTotal.toFixed(2),
        })
        const evaluation = evaluateReconciliation(
          revision.items.map(({ id, netAmount, status, currency }) => {
            if (
              !netAmount ||
              netAmount.isNegative() ||
              status !== "CALCULATED" ||
              currency.trim() !== "PHP"
            )
              fail(
                409,
                "The approved snapshot contains invalid payable amounts",
              )
            return { id, amount: netAmount }
          }),
          byRevision.get(revision.id) ?? [],
          revision.disbursement?.id,
        )
        for (const exception of evaluation.exceptions) {
          const key = exception.category + ":" + exception.subjectId
          if (countedExceptions.has(key)) continue
          countedExceptions.add(key)
          counts.set(
            exception.category,
            (counts.get(exception.category) ?? 0) + 1,
          )
          if (attention.length < 10)
            attention.push({
              id: run.id + ":" + exception.category + ":" + exception.subjectId,
              runId: run.id,
              period: period.cutoffLabel,
              category: "RECONCILIATION",
              status: "CURRENT",
              item: exception.category,
            })
        }
      }
      return {
        scope: {
          periods: periods.length,
          from: periods.at(-1)?.startDate ?? null,
          to: periods.reduce<Date | null>(
            (latest, period) =>
              !latest || period.endDate > latest ? period.endDate : latest,
            null,
          ),
        },
        approvedNet: approvedNet.toFixed(2),
        approvedRuns: revisions.length,
        realConfirmedPaid: "0.00",
        pendingApprovals,
        currentExceptions: [...counts.values()].reduce(
          (sum, count) => sum + count,
          0,
        ),
        trend: trend.reverse(),
        payoutCounts,
        exceptionCounts: [...counts].map(([category, count]) => ({
          category,
          count,
        })),
        attention,
      }
    },
    { isolationLevel: "RepeatableRead" },
  )
}
