import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "billing migration creates invoice and payment tables",
  { timeout: 120_000 },
  async (t) => {
    const { prisma } = await startPgliteApp(t)
    assert.equal(await prisma.invoice.count(), 0)
    assert.equal(await prisma.invoicePayment.count(), 0)
  },
)
