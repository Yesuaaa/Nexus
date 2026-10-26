import "dotenv/config"
import { getPrisma } from "../lib/db.js"

const prisma = getPrisma()
if (!prisma) throw new Error("Database unavailable")
try {
  const now = new Date()
  const [attempts, completions] = await prisma.$transaction([
    prisma.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.socialCompletion.deleteMany({ where: { expiresAt: { lte: now } } }),
  ])
  console.log(
    `Removed ${attempts.count} expired sign-in attempts and ${completions.count} completions`,
  )
} finally {
  await prisma.$disconnect()
}
