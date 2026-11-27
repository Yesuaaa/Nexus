import "dotenv/config"
import { disconnectPrisma, getPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { seedShowcaseWorkload } from "./showcase-workload.js"

async function main() {
  const mode = process.argv[2] ?? "--dry-run"
  const week = process.argv[3]
  if (
    !["--dry-run", "--apply"].includes(mode) ||
    !week ||
    process.argv.length !== 4
  )
    throw new Error("Use --dry-run or --apply followed by the Monday week date")
  const target = assertPhase2Target(process.env)
  const email = process.env.SHOWCASE_HEAD_EMAIL
  if (!email)
    throw new Error("Set SHOWCASE_HEAD_EMAIL to the confirmed department head")
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  try {
    const head = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, isActive: true, accountDeletedAt: true },
    })
    if (
      !head ||
      head.role !== "STAFF" ||
      !head.isActive ||
      head.accountDeletedAt
    )
      throw new Error("The selected account is not an active staff user")
    const result = await seedShowcaseWorkload(head.id, week, mode === "--apply")
    console.log(
      JSON.stringify({
        database: target.database,
        head: email,
        week,
        mode,
        result,
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Showcase workload failed. Check prerequisites and the configured target.",
  )
  process.exitCode = 1
})
