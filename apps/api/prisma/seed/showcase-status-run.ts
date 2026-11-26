import "dotenv/config"
import { getPrisma, disconnectPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { seedShowcaseOnHold } from "./showcase-status.js"

async function main() {
  const mode = process.argv[2] ?? "--dry-run"
  if (!["--dry-run", "--apply"].includes(mode) || process.argv.length > 3)
    throw new Error("Choose --dry-run or --apply")
  const target = assertPhase2Target(process.env)
  const email = process.env.SHOWCASE_HEAD_EMAIL
  if (!email)
    throw new Error("Set SHOWCASE_HEAD_EMAIL to the confirmed department head")
  const db = getPrisma()
  if (!db) throw new Error("Database configuration is required")
  try {
    const head = await db.user.findUnique({
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
    const result = await seedShowcaseOnHold(head.id, mode === "--apply")
    console.log(
      JSON.stringify({ database: target.database, mode, head: email, result }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch(() => {
  console.error(
    "Showcase status seed failed. Check project state and the configured target.",
  )
  process.exitCode = 1
})
