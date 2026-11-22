import assert from "node:assert/strict"
import { test } from "node:test"
import {
  migrationNames,
  recordAppliedMigrations,
  startPgliteApp,
} from "../../support/pglite-app.js"

test("production health and traffic require the release ledger and schema", async (t) => {
  const { db, origin } = await startPgliteApp(t, {
    app: { requireReadyDatabase: true },
  })

  async function check(status: 200 | 503) {
    for (const [path, expected] of [
      ["health", 200],
      ["db-check", 200],
      ["ready", status],
    ] as const) {
      const response = await fetch(`${origin}/api/${path}`)
      assert.equal(response.status, expected, path)
      assert.deepEqual(await response.json(), {
        status: expected === 200 ? "ok" : "unavailable",
      })
    }
    const response = await fetch(`${origin}/api/auth/me`)
    assert.equal(response.status, status === 200 ? 401 : 503)
    if (status === 503)
      assert.deepEqual(await response.json(), { status: "unavailable" })
  }

  await check(503)
  await recordAppliedMigrations(db)
  await check(200)

  const latest = (await migrationNames()).at(-1)!
  await db.query(
    `UPDATE public._prisma_migrations SET finished_at = NULL WHERE migration_name = $1`,
    [latest],
  )
  await check(503)
  await db.query(
    `UPDATE public._prisma_migrations SET finished_at = now() WHERE migration_name = $1`,
    [latest],
  )
  await check(200)

  await db.exec(
    `INSERT INTO public._prisma_migrations (migration_name, checksum, finished_at) VALUES ('future_release', 'fixture', now())`,
  )
  await check(503)
  await db.exec(
    `UPDATE public._prisma_migrations SET finished_at = NULL, rolled_back_at = now() WHERE migration_name = 'future_release'`,
  )
  await check(200)

  await db.exec(
    `ALTER TABLE public."LeaveRequest" RENAME COLUMN "reason" TO "renamed_reason"`,
  )
  await check(503)
  await db.exec(
    `ALTER TABLE public."LeaveRequest" RENAME COLUMN "renamed_reason" TO "reason"`,
  )
  await check(200)

  await db.query(
    `UPDATE public._prisma_migrations SET checksum = 'mismatch' WHERE migration_name = $1`,
    [latest],
  )
  await check(503)
})
