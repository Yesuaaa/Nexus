import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"
import { databasePoolConfig } from "./postgres-connection.js"

let client: PrismaClient | undefined

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connectionString) return undefined

  if (!client) {
    const pool = new pg.Pool({
      ...databasePoolConfig(connectionString),
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      connectionTimeoutMillis: 5_000,
    })

    client = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    })
  }

  return client
}

/** Reset the shared client after an isolated test database has shut down. */
export async function disconnectPrisma() {
  const current = client
  client = undefined
  await current?.$disconnect()
}
