import { Router } from "express"
import { getPrisma } from "../../lib/db.js"

export const healthRouter = Router()

healthRouter.get("/health", (_request, response) => {
  response.json({ status: "ok" })
})

healthRouter.get("/db-check", async (_request, response) => {
  const prisma = getPrisma()
  if (!prisma) {
    response.status(503).json({
      status: "unavailable",
      message: "DATABASE_URL is not configured",
    })
    return
  }
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: "ok" })
  } catch (error) {
    console.error("Database check failed:", error)
    response.status(503).json({ status: "unavailable" })
  }
})
