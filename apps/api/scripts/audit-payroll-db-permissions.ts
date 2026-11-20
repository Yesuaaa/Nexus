import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

import {
  auditPayrollDatabasePermissions,
  createPayrollAuditClient,
  requireExplicitPayrollAuditUrl,
  type PayrollAuditQueryClient,
} from "../src/lib/payroll-db-permissions-audit.js"

async function main() {
  let client: ReturnType<typeof createPayrollAuditClient> | undefined
  try {
    const connectionString = requireExplicitPayrollAuditUrl(process.env)
    client = createPayrollAuditClient(connectionString)
    await client.connect()
    const auditClient: PayrollAuditQueryClient = {
      query: async (text) => {
        const result = await client!.query(text)
        return {
          rows: result.rows as unknown as Record<string, unknown>[],
        }
      },
    }
    const report = await auditPayrollDatabasePermissions(auditClient)
    console.log(JSON.stringify(report, null, 2))
    if (report.verdict === "FAIL") process.exitCode = 2
    else if (report.verdict === "UNVERIFIED") process.exitCode = 3
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "unavailable"
    console.error(
      `Payroll database permissions audit could not complete (code ${code}). No connection string or database error text was logged.`,
    )
    process.exitCode = 3
  } finally {
    await client?.end().catch(() => {})
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main()
}
