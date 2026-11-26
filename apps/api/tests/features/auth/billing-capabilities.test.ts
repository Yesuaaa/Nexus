import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  BillingCapability,
  hasBillingCapability,
} from "../../../src/features/auth/auth.capabilities.js"
import { isSandboxWorkflowPayment } from "../../../src/features/request-workflow/workflow-payment.js"

test("billing capabilities are scoped to active Admin and read-only Superadmin", () => {
  for (const [role, read, manage] of [
    [Role.ADMIN, true, true],
    [Role.SUPERADMIN, true, false],
    [Role.STAFF, false, false],
    [Role.USER, false, false],
  ] as const) {
    const actor = { id: "actor", role, isActive: true, accountDeletedAt: null }
    assert.equal(hasBillingCapability(actor, BillingCapability.READ), read)
    assert.equal(hasBillingCapability(actor, BillingCapability.MANAGE), manage)
    assert.equal(
      hasBillingCapability(
        { ...actor, isActive: false },
        BillingCapability.READ,
      ),
      false,
    )
    assert.equal(
      hasBillingCapability(
        { ...actor, accountDeletedAt: new Date() },
        BillingCapability.MANAGE,
      ),
      false,
    )
  }
})

test("workflow sandbox identification preserves existing verified-payment rules", () => {
  const payment = {
    status: "VERIFIED",
    verifiedById: null,
    reference: "XENDIT-SANDBOX-123",
  }
  assert.equal(isSandboxWorkflowPayment(payment), true)
  assert.equal(
    isSandboxWorkflowPayment({ ...payment, status: "PENDING" }),
    false,
  )
  assert.equal(
    isSandboxWorkflowPayment({ ...payment, verifiedById: "user" }),
    false,
  )
  assert.equal(isSandboxWorkflowPayment({ ...payment, reference: null }), false)
  assert.equal(
    isSandboxWorkflowPayment({ ...payment, reference: "PAYMENT-123" }),
    false,
  )
})
