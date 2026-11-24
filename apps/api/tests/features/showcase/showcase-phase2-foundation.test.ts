import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteDatabase } from "../../support/pglite-app.js"
import {
  assertPhase2Target,
  bootstrapShowcase,
} from "../../../prisma/seed/showcase-phase2-foundation.js"
import { seedShowcase } from "../../../prisma/seed/showcase-core.js"

const env = (database: string) => ({
  NODE_ENV: "development",
  DATABASE_URL: `postgresql://demo:secret@127.0.0.1:5433/${database}`,
  SHOWCASE_CONFIRM_TARGET: "nexus_showcase",
})

test("Phase 2 target validation requires explicit development opt-in", () => {
  assert.equal(
    assertPhase2Target(env("nexus_showcase")).database,
    "nexus_showcase",
  )
  assert.throws(() => assertPhase2Target(env("nexus_dev")))
  assert.throws(() =>
    assertPhase2Target({ ...env("nexus_dev"), SHOWCASE_ALLOW_DEV: "true" }),
  )
  assert.equal(
    assertPhase2Target({
      ...env("nexus_dev"),
      SHOWCASE_ALLOW_DEV: "true",
      SHOWCASE_CONFIRM_TARGET: "nexus_dev",
    }).database,
    "nexus_dev",
  )
  assert.throws(() =>
    assertPhase2Target({
      ...env("nexus_showcase"),
      SHOWCASE_CONFIRM_TARGET: "nexus_dev",
    }),
  )
  assert.throws(() =>
    assertPhase2Target({
      ...env("nexus_showcase"),
      DIRECT_URL: "postgresql://localhost/nexus_dev",
    }),
  )
})

test(
  "isolated bootstrap supports the Phase 1 seed without overwriting existing data",
  { timeout: 120_000 },
  async (t) => {
    const { prisma } = await startPgliteDatabase(t)
    await bootstrapShowcase(prisma, "IllustrativeStrongPass1!")
    const seeded = await seedShowcase(prisma, "IllustrativeStrongPass1!")
    assert.equal(seeded.created, true)
    assert.equal(await prisma.project.count(), 12)
    assert.equal(await prisma.invoice.count(), 36)
    await assert.rejects(
      () => bootstrapShowcase(prisma, "IllustrativeStrongPass1!"),
      /requires an empty/,
    )
    assert.equal(await prisma.project.count(), 12)
  },
)
