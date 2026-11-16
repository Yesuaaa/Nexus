import type { TestContext } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { createApp } from "../../src/app.js"
import { getPrisma } from "../../src/lib/db.js"
import {
  applyMigrations,
  startPgliteDatabase,
  listen,
  closeServer,
} from "./pglite-app.js"

/** Activation proof is fixture ownership, not an environment enable flag. This
 * helper is test-only and never imported by production source or startApi. */
export async function startSystemLogsApp(t: TestContext) {
  const fixture = await startPgliteDatabase(t, {
    migrate: async (db) => {
      await applyMigrations(db)
      await db.exec("SET TIME ZONE 'UTC'")
    },
  })
  const databaseUrl = process.env.DATABASE_URL
  const app = createApp({
    systemLogsOfflineFixture: () =>
      fixture.db instanceof PGlite &&
      !fixture.db.closed &&
      getPrisma() === fixture.prisma &&
      process.env.DATABASE_URL === databaseUrl &&
      process.env.DIRECT_URL === undefined,
  })
  const { server, origin } = await listen(app)
  fixture.beforeShutdown(() => closeServer(server))
  return { ...fixture, server, origin, base: `${origin}/api/system-logs` }
}
