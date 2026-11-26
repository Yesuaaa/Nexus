import "dotenv/config"
import { disconnectPrisma, getPrisma } from "../../src/lib/db.js"
import {
  assertShowcasePassword,
  assertShowcaseTarget,
  plannedCounts,
} from "./showcase-plan.js"
import { seedShowcase } from "./showcase-core.js"
import { cleanupShowcase } from "./showcase-cleanup.js"

async function main() {
  const mode = process.argv[2] || "--dry-run"
  if (
    !["--dry-run", "--apply", "--cleanup"].includes(mode) ||
    process.argv.length > 3
  )
    throw new Error("Choose exactly one: --dry-run, --apply, or --cleanup")
  const target = assertShowcaseTarget(process.env)
  console.log(
    `Showcase ${mode}: ${target.host}:${target.port}/${target.database}`,
  )
  if (mode === "--dry-run") {
    console.log(
      JSON.stringify(
        {
          planned: plannedCounts,
          status: "partial",
          requires:
            "An active staff department head with an assigned active service, and a strong SHOWCASE_PASSWORD for --apply",
          omitted: [
            "attendance",
            "payroll runs",
            "payslips",
            "workflow audit events",
            "workflow notifications",
            "payment gateway transactions",
          ],
        },
        null,
        2,
      ),
    )
    return
  }
  if (process.env.SHOWCASE_CONFIRM_TARGET !== target.database)
    throw new Error(
      "Set SHOWCASE_CONFIRM_TARGET to the exact local database name",
    )
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  try {
    if (mode === "--cleanup")
      console.log(JSON.stringify(await cleanupShowcase(prisma)))
    else {
      if (process.env.SHOWCASE_ACKNOWLEDGE_PARTIAL !== "true")
        throw new Error(
          "This seed is incomplete; set SHOWCASE_ACKNOWLEDGE_PARTIAL=true to explicitly use the partial dataset",
        )
      assertShowcasePassword(process.env.SHOWCASE_PASSWORD)
      console.log(
        JSON.stringify(
          await seedShowcase(prisma, process.env.SHOWCASE_PASSWORD),
        ),
      )
    }
  } finally {
    await disconnectPrisma()
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Showcase seed failed")
  process.exitCode = 1
})
