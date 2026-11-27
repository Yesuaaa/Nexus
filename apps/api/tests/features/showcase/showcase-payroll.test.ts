import assert from "node:assert/strict"
import { test } from "node:test"
import type { AuthContext } from "../../../src/features/auth/auth.middleware.js"
import {
  seedShowcaseCompensation,
  showcaseCompensationRevision,
} from "../../../prisma/seed/showcase-payroll.js"

test("showcase compensation revisions are valid, varied and repeatable", () => {
  const start = new Date("2026-01-01T00:00:00.000Z")
  const rows = Array.from({ length: 20 }, (_, index) =>
    showcaseCompensationRevision(index, start),
  )
  assert.equal(new Set(rows.map((row) => row.baseRate)).size, 20)
  assert.ok(rows.every((row) => row.effectiveFrom.getUTCDate() === 1))
  assert.ok(
    rows.every(
      (row) =>
        row.payType === "MONTHLY" &&
        row.components.length === 2 &&
        Number(row.baseRate) >= 18000 &&
        Number(row.baseRate) <= 65000,
    ),
  )
  assert.deepEqual(showcaseCompensationRevision(0, start), rows[0])
  assert.throws(() => showcaseCompensationRevision(20, start))
})

test("compensation seeding refuses the development database", async () => {
  const previous = { ...process.env }
  try {
    process.env.NODE_ENV = "development"
    process.env.DATABASE_URL =
      "postgresql://local:local@127.0.0.1:5433/nexus_dev"
    delete process.env.DIRECT_URL
    process.env.SHOWCASE_CONFIRM_TARGET = "nexus_dev"
    await assert.rejects(
      () => seedShowcaseCompensation({} as AuthContext),
      /separate local nexus_showcase/,
    )
  } finally {
    for (const key of [
      "NODE_ENV",
      "DATABASE_URL",
      "DIRECT_URL",
      "SHOWCASE_CONFIRM_TARGET",
    ]) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
