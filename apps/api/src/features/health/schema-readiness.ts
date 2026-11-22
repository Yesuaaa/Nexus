import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { $Enums, Prisma } from "../../generated/prisma/client.js"
import { getPrisma } from "../../lib/db.js"

export const databaseProbeOptions = { maxWait: 2_500, timeout: 3_500 }

const migrationsDirectory = new URL(
  "../../../prisma/migrations/",
  import.meta.url,
)
const columns = JSON.stringify(
  Object.values(Prisma.ModelName).map((name) => ({
    name,
    columns: Object.values(Prisma[`${name}ScalarFieldEnum`]),
  })),
)
const enumLabels = JSON.stringify(
  Object.fromEntries(
    Object.entries($Enums).map(([name, labels]) => [
      name,
      Object.values(labels).sort(),
    ]),
  ),
)

let expectedMigrations: { count: number; digest: string } | undefined
let inFlight: Promise<boolean> | undefined

function releaseMigrations() {
  if (expectedMigrations) return expectedMigrations
  const names = readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .sort()
  const entries = names.map((name) => {
    const sql = readFileSync(
      new URL(`${name}/migration.sql`, migrationsDirectory),
    )
    return `${name}:${createHash("sha256").update(sql).digest("hex")}`
  })
  expectedMigrations = {
    count: names.length,
    digest: createHash("sha256").update(entries.join(",")).digest("hex"),
  }
  return expectedMigrations
}

async function verifySchema() {
  try {
    const prisma = getPrisma()
    if (!prisma) return false
    const expected = releaseMigrations()
    if (expected.count === 0) return false

    return await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SET LOCAL statement_timeout = '2500ms'`
      const [result] = await transaction.$queryRaw<{ compatible: boolean }[]>`
        SELECT (
          (SELECT count(*) = ${expected.count}
            AND bool_and(finished_at IS NOT NULL)
            AND encode(sha256(convert_to(string_agg(migration_name || ':' || checksum, ','
              ORDER BY migration_name COLLATE "C"), 'UTF8')), 'hex') = ${expected.digest}
          FROM (
            SELECT migration_name, checksum, finished_at
            FROM public._prisma_migrations
            WHERE rolled_back_at IS NULL
            LIMIT ${expected.count + 1}
          ) AS active)
          AND current_schema() = 'public'
          AND current_setting('transaction_read_only') = 'off'
          AND NOT EXISTS (
              SELECT 1
              FROM jsonb_to_recordset(${columns}::jsonb) AS model(name text, columns jsonb)
              CROSS JOIN LATERAL jsonb_array_elements_text(model.columns) AS expected_column(name)
              LEFT JOIN pg_catalog.pg_class AS relation
                ON relation.oid = to_regclass(format('%I', model.name))
                AND relation.relnamespace = 'public'::regnamespace
                AND relation.relkind IN ('r', 'p')
              LEFT JOIN pg_catalog.pg_attribute AS attribute
                ON attribute.attrelid = relation.oid
                AND attribute.attname = expected_column.name
                AND attribute.attnum > 0 AND NOT attribute.attisdropped
              WHERE attribute.attnum IS NULL
          )
          AND NOT EXISTS (
              SELECT 1 FROM jsonb_each(${enumLabels}::jsonb) AS expected_enum(name, labels)
              LEFT JOIN pg_catalog.pg_type AS enum_type
                ON enum_type.typnamespace = 'public'::regnamespace
                AND enum_type.typname = expected_enum.name
                AND enum_type.typtype = 'e'
              WHERE expected_enum.labels IS DISTINCT FROM (
                SELECT jsonb_agg(enumlabel ORDER BY enumlabel COLLATE "C")
                FROM pg_catalog.pg_enum WHERE enumtypid = enum_type.oid
              )
          )
        ) IS TRUE AS compatible
      `
      return result.compatible
    }, databaseProbeOptions)
  } catch {
    return false
  }
}

export function checkSchemaReadiness() {
  // Share concurrent probes, while checking fresh state for the next request.
  inFlight ??= verifySchema().finally(() => {
    inFlight = undefined
  })
  return inFlight
}
