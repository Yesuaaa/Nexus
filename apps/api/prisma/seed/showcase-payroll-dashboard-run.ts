import "dotenv/config"
import { disconnectPrisma } from "../../src/lib/db.js"
import { seedPayrollDashboard } from "./showcase-payroll-dashboard.js"

async function main() {
  if (
    process.argv.length !== 3 ||
    !["--apply", "--trend"].includes(process.argv[2])
  )
    throw new Error(
      "Use --apply or --trend after validating the payroll showcase seed",
    )
  const password = process.env.SHOWCASE_PASSWORD
  if (!password) throw new Error("SHOWCASE_PASSWORD is required")
  try {
    console.log(
      JSON.stringify(
        await seedPayrollDashboard(password, process.argv[2] === "--trend"),
      ),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Payroll showcase failed",
  )
  process.exitCode = 1
})
