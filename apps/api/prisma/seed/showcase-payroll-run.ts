import "dotenv/config"
import { getPrisma, disconnectPrisma } from "../../src/lib/db.js"
import { authService } from "../../src/features/auth/auth.service.js"
import { verifyAccessToken } from "../../src/features/auth/auth.jwt.js"
import { assertPhase2Target } from "./showcase-phase2-foundation.js"
import { seedShowcaseCompensation } from "./showcase-payroll.js"

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--apply")
    throw new Error("Use --apply after validating the compensation seed")
  const target = assertPhase2Target(process.env)
  const password = process.env.SHOWCASE_PASSWORD
  if (!password) throw new Error("SHOWCASE_PASSWORD is required")
  const prisma = getPrisma()
  if (!prisma) throw new Error("Database configuration is required")
  let sessionId: string | undefined
  try {
    const login = await authService.login({
      email: "operations@showcase.invalid",
      password,
    })
    const claims = await verifyAccessToken(login.token)
    sessionId = claims.sessionId
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: claims.userId },
    })
    const result = await seedShowcaseCompensation({ user, sessionId })
    console.log(JSON.stringify({ database: target.database, ...result }))
  } finally {
    if (sessionId) await authService.logout(sessionId)
    await disconnectPrisma()
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Compensation seed failed",
  )
  process.exitCode = 1
})
