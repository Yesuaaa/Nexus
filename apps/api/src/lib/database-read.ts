import { setTimeout as delay } from "node:timers/promises"
import { Prisma } from "../generated/prisma/client.js"
import { getPrisma } from "./db.js"

const connectionErrors = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
  "P2034",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
])

export function isTemporaryDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const code =
    "code" in error
      ? error.code
      : error instanceof Prisma.PrismaClientInitializationError
        ? error.errorCode
        : undefined
  return (
    (typeof code === "string" && connectionErrors.has(code)) ||
    (code === "P2028" && /timeout|timed out|expired/i.test(error.message))
  )
}

// Only use for reads. Never replay an action, upload, or other mutation.
export async function readDatabase<T>(read: () => Promise<T>): Promise<T> {
  const started = Date.now()
  try {
    return await read()
  } catch (error) {
    // Keep the retry within the web proxy's request budget. A slow transaction
    // must not be repeated for another twenty seconds.
    if (!isTemporaryDatabaseError(error) || Date.now() - started >= 5_000)
      throw error
    await delay(150)
    return read()
  }
}

export function readTransaction<T>(
  read: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return readDatabase(() =>
    getPrisma()!.$transaction(read, {
      isolationLevel: "RepeatableRead",
      maxWait: 5_000,
      timeout: 20_000,
    }),
  )
}
