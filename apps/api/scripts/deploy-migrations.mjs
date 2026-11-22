import { execFile } from "node:child_process"
import { resolve } from "node:path"
import { promisify, stripVTControlCharacters } from "node:util"
import pg from "pg"
import { checkSchemaReadiness } from "../dist/features/health/schema-readiness.js"
import { databasePoolConfig, getPrisma } from "../dist/lib/db.js"

const run = promisify(execFile)

function validateUrl(value) {
  const url = new URL(value)
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !url.pathname.slice(1) ||
    url.searchParams.getAll("schema").some((schema) => schema !== "public")
  ) {
    throw new Error("Expected a PostgreSQL URL for the public schema")
  }
  return url
}

async function databaseIdentity(connectionString) {
  const client = new pg.Client({
    ...databasePoolConfig(connectionString),
    connectionTimeoutMillis: 5_000,
    query_timeout: 3_000,
  })
  try {
    await client.connect()
    const {
      rows: [identity],
    } = await client.query(`
      SELECT datname AS name, oid::text AS oid,
             extract(epoch FROM pg_postmaster_start_time())::text AS instance
      FROM pg_catalog.pg_database
      WHERE datname = current_database()
        AND current_schema() = 'public'
        AND NOT pg_is_in_recovery()
        AND current_setting('transaction_read_only') = 'off'
    `)
    return identity
  } finally {
    await client.end()
  }
}

async function deploy() {
  const runtimeUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL || runtimeUrl

  try {
    validateUrl(runtimeUrl)
    const direct = validateUrl(directUrl)
    if (direct.searchParams.getAll("pgbouncer").includes("true")) {
      throw new Error("Expected a direct or session-pooled migration URL")
    }
    const [runtime, directTarget] = await Promise.all([
      databaseIdentity(runtimeUrl),
      databaseIdentity(directUrl),
    ])
    if (
      !runtime ||
      !directTarget ||
      runtime.name !== directTarget.name ||
      runtime.oid !== directTarget.oid ||
      runtime.instance !== directTarget.instance
    ) {
      throw new Error("Database targets differ")
    }
  } catch {
    console.error(
      "Migration preflight failed. Verify that DATABASE_URL and DIRECT_URL reach the same writable PostgreSQL database and public schema, with a direct or session-pooled migration connection.",
    )
    return 1
  }

  try {
    const env = { ...process.env, DIRECT_URL: directUrl, NO_COLOR: "1" }
    delete env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK
    await run(
      process.execPath,
      [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
      { env },
    )
  } catch (error) {
    const stderr = stripVTControlCharacters(error?.stderr ?? "")
    const code = /^Error:\s*(P\d{4})\b/m.exec(stderr)?.[1]
    console.error(
      `Prisma migration deployment failed${code ? ` (${code})` : ""}. Inspect the migration ledger in a restricted operator session.`,
    )
    return 1
  }

  if (!(await checkSchemaReadiness())) {
    console.error(
      "Migration postflight failed. The runtime connection could not verify the release schema and migration ledger.",
    )
    return 1
  }
  console.log("Prisma migrations deployed and runtime schema verified.")
  return 0
}

try {
  process.exitCode = await deploy()
} finally {
  await getPrisma()
    ?.$disconnect()
    .catch(() => {
      console.error("Could not close the migration verification connection.")
      process.exitCode = 1
    })
}
