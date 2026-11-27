import assert from "node:assert/strict"
import { test } from "node:test"
import { canRespondToQuotation } from "../src/features/request-workflow/model/workflow.ts"

test("only the owning client can respond to the latest unexpired sent quotation", () => {
  const now = Date.parse("2026-11-22T00:00:00Z")
  const old = { id: "old", status: "SENT", validUntil: "2026-11-24T00:00:00Z" }
  const latest = { ...old, id: "latest" }
  const workflow = {
    state: "CLIENT_APPROVAL",
    permissions: { isClient: true },
    quotations: [old, latest],
  }

  assert.equal(canRespondToQuotation(workflow, latest, now), true)
  assert.equal(canRespondToQuotation(workflow, old, now), false)
  assert.equal(
    canRespondToQuotation(workflow, latest, Date.parse(latest.validUntil)),
    false,
  )
  for (const state of [
    "QUOTATION_PENDING",
    "ON_HOLD",
    "CANCELLED",
    "AGREEMENT_PAYMENT_PENDING",
  ]) {
    assert.equal(
      canRespondToQuotation({ ...workflow, state }, latest, now),
      false,
    )
  }
  for (const status of ["SUPERSEDED", "ACCEPTED", "PENDING_INTERNAL"]) {
    assert.equal(
      canRespondToQuotation(workflow, { ...latest, status }, now),
      false,
    )
  }
  assert.equal(
    canRespondToQuotation(
      { ...workflow, permissions: { isClient: false } },
      latest,
      now,
    ),
    false,
  )
})
