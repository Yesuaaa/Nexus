import "dotenv/config"
import { disconnectPrisma, getPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { seedFinalShowcaseStaff } from "./showcase-final-staff.js"

async function main() {
  const mode = process.argv[2]
  const week = process.argv[3]
  if (
    !["--dry-run", "--apply"].includes(mode ?? "") ||
    !week ||
    process.argv.length !== 4
  )
    throw new Error("Choose --dry-run or --apply and a Monday week")
  const target = assertPhase2Target(process.env)
  const db = getPrisma()
  if (!db) throw new Error("Database configuration is required")
  try {
    const head = await db.user.findUniqueOrThrow({
      where: { email: "advertising.head@local.test" },
      select: { id: true },
    })
    const result = await seedFinalShowcaseStaff(
      head.id,
      week,
      mode === "--apply",
    )
    console.log(
      JSON.stringify({ database: target.database, week, mode, result }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Showcase staff refinement failed. Check target and prerequisites.",
  )
  process.exitCode = 1
})
