import assert from "node:assert/strict"
import { test } from "node:test"
import { Prisma } from "../../../src/generated/prisma/client.js"
import { evaluateReconciliation } from "../../../src/features/payroll/payroll-reconciliation.service.js"

const obligations = [
  { id: "one", amount: new Prisma.Decimal("0.10") },
  { id: "two", amount: new Prisma.Decimal("0.20") },
  { id: "zero", amount: new Prisma.Decimal("0") },
]

function payout(
  index: number,
  outcome: "SUCCEEDED" | "FAILED" | "PENDING",
  amount = obligations[index]!.amount,
) {
  return {
    id: "payout-" + index,
    payrollItemId: obligations[index]!.id,
    batchId: "batch",
    amount,
    attempt: { id: "attempt-" + index, outcome, createdAt: new Date(0) },
  }
}

test("reconciliation separates simulated confirmations from real payments and preserves precision", () => {
  const payouts = [payout(0, "SUCCEEDED"), payout(1, "SUCCEEDED")]
  const result = evaluateReconciliation(obligations, payouts, "batch")
  assert.equal(result.status, "MATCHED")
  assert.equal(result.amounts.simulatedConfirmed, "0.30")
  assert.equal(result.amounts.realPaid, "0.00")
  assert.equal(result.amounts.unresolved, "0.00")
  assert.deepEqual(
    evaluateReconciliation(obligations, payouts, "batch"),
    result,
  )
})

test("reconciliation distinguishes partial and pending outcomes", () => {
  const pending = evaluateReconciliation(
    obligations,
    [payout(0, "PENDING"), payout(1, "PENDING")],
    "batch",
  )
  assert.equal(pending.status, "PENDING")
  assert.equal(pending.amounts.pending, "0.30")
  assert.equal(pending.amounts.simulatedConfirmed, "0.00")
  const partial = evaluateReconciliation(
    obligations,
    [payout(0, "SUCCEEDED"), payout(1, "PENDING")],
    "batch",
  )
  assert.equal(partial.status, "PARTIALLY_MATCHED")
  assert.equal(partial.amounts.unresolved, "0.20")
})

test("reconciliation classifies amount, missing and unmatched discrepancies", () => {
  const result = evaluateReconciliation(
    obligations,
    [
      payout(0, "SUCCEEDED", new Prisma.Decimal("0.09")),
      { ...payout(1, "SUCCEEDED"), batchId: "wrong-batch" },
    ],
    "batch",
  )
  assert.equal(result.status, "EXCEPTION")
  assert.equal(result.amounts.simulatedConfirmed, "0.09")
  assert.deepEqual(
    result.exceptions.map(({ category }) => category),
    ["UNMATCHED_PAYOUT", "AMOUNT_MISMATCH", "MISSING_PAYOUT_RECORD"],
  )
})
