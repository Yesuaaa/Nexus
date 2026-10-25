import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

let client: PrismaClient | undefined

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connectionString) return undefined

  if (!client) {
    const isLocalOrSupabase =
      connectionString.includes("supabase.com") ||
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1")

    const pool = new pg.Pool({
      connectionString,
      ssl: isLocalOrSupabase ? { rejectUnauthorized: false } : undefined,
    })

    client = new PrismaClient({
      adapter: new PrismaPg(pool),
    })
  }

  return client
}
