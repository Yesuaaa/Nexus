import { getPrisma } from "../../lib/db.js"

/** Shared with existing public readiness routes; no retry or new connection pool. */
export async function checkDatabase() {
  try {
    const prisma = getPrisma()
    if (!prisma) return "not-configured" as const
    await prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET LOCAL statement_timeout = '2500ms'`
        await transaction.$queryRaw`SELECT 1`
      },
      { maxWait: 2_500, timeout: 3_500 },
    )
    return "ok" as const
  } catch (error: unknown) {
    console.error(
      "Database health check failed",
      error instanceof Error ? error.name : "unknown error",
    )
    return "unavailable" as const
  }
}
