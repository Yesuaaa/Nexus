import { Router, type RequestHandler } from "express"
import { getPrisma } from "../../lib/db.js"
import {
  checkSchemaReadiness,
  databaseProbeOptions,
} from "./schema-readiness.js"

async function checkDatabase() {
  try {
    const prisma = getPrisma()
    if (!prisma) return "not-configured" as const

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SET LOCAL statement_timeout = '2500ms'`
      await transaction.$queryRaw`SELECT 1`
    }, databaseProbeOptions)
    return "ok" as const
  } catch (error: unknown) {
    console.error(
      "Database health check failed",
      error instanceof Error ? error.name : "unknown error",
    )
    return "unavailable" as const
  }
}

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

    if ((await checkSchemaReadiness()) && !isShuttingDown()) {
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

export function requireReadyDatabase(
  isShuttingDown: () => boolean,
): RequestHandler {
  return async (_request, response, next) => {
    if (
      !isShuttingDown() &&
      (await checkSchemaReadiness()) &&
      !isShuttingDown()
    ) {
      next()
      return
    }
    response.status(503).json({ status: "unavailable" })
  }
}
