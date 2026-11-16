import { Router } from "express"
import { checkDatabase } from "./database-readiness.js"

export function createHealthRouter(
  isShuttingDown: () => boolean = () => false,
) {
  const healthRouter = Router()

  healthRouter.get("/health", (_request, response) => {
    response.json({ status: "ok" })
  })

  healthRouter.get("/ready", async (_request, response) => {
    if (isShuttingDown()) {
      response.status(503).json({ status: "unavailable" })
      return
    }

    const result = await checkDatabase()
    if (result === "ok") {
      response.json({ status: "ok" })
      return
    }

    response.status(503).json({ status: "unavailable" })
  })

  healthRouter.get("/db-check", async (_request, response) => {
    const result = await checkDatabase()
    if (result === "ok") {
      response.json({ status: "ok" })
      return
    }

    if (result === "not-configured") {
      response.status(503).json({
        status: "unavailable",
        message: "DATABASE_URL is not configured",
      })
      return
    }

    response.status(503).json({ status: "unavailable" })
  })

  return healthRouter
}
