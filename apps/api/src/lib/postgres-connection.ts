import { readFileSync } from "node:fs"
import { getCACertificates } from "node:tls"

import pg from "pg"

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

export function databasePoolConfig(connectionString: string): pg.PoolConfig {
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
