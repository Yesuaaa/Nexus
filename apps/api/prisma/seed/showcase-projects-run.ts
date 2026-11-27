import "dotenv/config"
import { getPrisma, disconnectPrisma } from "../../src/lib/db.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { seedShowcaseProjects } from "./showcase-projects.js"

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--apply")
    throw new Error("Use --apply after validating the showcase project seed")
  const target = assertPhase2Target(process.env)
  const email = process.env.SHOWCASE_HEAD_EMAIL
  if (!email)
    throw new Error(
      "Set SHOWCASE_HEAD_EMAIL to the responsible department head",
    )
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
    const boards = await seedShowcaseProjects(head.id)
    console.log(
      JSON.stringify({ database: target.database, head: email, boards }),
    )
  } finally {
    await disconnectPrisma()
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Project seed failed")
  process.exitCode = 1
})
