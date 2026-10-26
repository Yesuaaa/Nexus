import { readFileSync } from "node:fs"
import { getCACertificates } from "node:tls"

import pg from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

let client: PrismaClient | undefined

const trustedDatabaseCas = [
  ...new Set([
    ...getCACertificates("bundled"),
    ...getCACertificates("system"),
    ...getCACertificates("extra"),
    readFileSync(
      new URL("../../../../certs/supabase-root-2021.crt", import.meta.url),
      "utf8",
    ),
  ]),
]

function databasePoolConfig(connectionString: string): pg.PoolConfig {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    return { connectionString }
  }

  const hostname = url.hostname.toLowerCase()
  const isSupabase =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com")
  if (!isSupabase) {
    return { connectionString }
  }

  // pg-connection-string replaces an explicit `ssl` object when these options
  // are present in the URL. Remove them so our verified CA configuration wins.
  url.searchParams.delete("sslmode")
  url.searchParams.delete("sslrootcert")

  return {
    connectionString: url.toString(),
    ssl: {
      ca: trustedDatabaseCas,
      rejectUnauthorized: true,
    },
  }
}

export function getPrisma() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connectionString) return undefined

  if (!client) {
    const pool = new pg.Pool({
      ...databasePoolConfig(connectionString),
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
    })

    client = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    })
  }

  return client
}
