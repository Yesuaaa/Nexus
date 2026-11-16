import { createServer, type Server } from "node:http"
import { createApp } from "./app.js"
import { jwtKey } from "./features/auth/auth.jwt.js"
import { conversationRealtime } from "./features/request-conversations/request-conversations.realtime.js"
import { purgeExpiredConversationMessages } from "./features/request-conversations/request-conversations.service.js"
import { getPrisma } from "./lib/db.js"
import { createGracefulShutdown } from "./graceful-shutdown.js"

type DatabaseEnvironment = {
  NODE_ENV?: string
  DATABASE_URL?: string
  DIRECT_URL?: string
}

export function validateProductionDatabaseConfig(
  environment: DatabaseEnvironment = process.env,
) {
  if (environment.NODE_ENV !== "production") return

  const configuredUrl = environment.DATABASE_URL || environment.DIRECT_URL
  const databaseUrl = configuredUrl?.trim()
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or DIRECT_URL must be configured in production",
    )
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL")
  }

  const validProtocol =
    parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
  const configuredHost =
    parsed.hostname.length > 0 ||
    parsed.searchParams.getAll("host").some((host) => host.trim().length > 0)
  if (!validProtocol || !configuredHost) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL")
  }
}

export function startApi(): {
  server: Server
  shutdown: (signal: NodeJS.Signals) => Promise<void>
} {
  validateProductionDatabaseConfig()
  jwtKey()

  const port = Number(process.env.PORT || 3001)
  let isShuttingDown = false
  const server = createServer(
    createApp({ isShuttingDown: () => isShuttingDown }),
  )
  server.listen(port, () =>
    console.log(`API listening on http://localhost:${port}`),
  )

  function purgeExpiredMessages() {
    void purgeExpiredConversationMessages().catch(() => {
      console.error("Unable to purge expired conversation messages")
    })
  }

  purgeExpiredMessages()
  const messagePurgeTimer = setInterval(purgeExpiredMessages, 60 * 60 * 1000)
  messagePurgeTimer.unref()

  const onSigterm = () => {
    void shutdown("SIGTERM")
  }
  const onSigint = () => {
    void shutdown("SIGINT")
  }

  const shutdown = createGracefulShutdown({
    server,
    onStart: () => {
      isShuttingDown = true
      clearInterval(messagePurgeTimer)
    },
    cleanupResources: async () => {
      const results = await Promise.allSettled([
        Promise.resolve().then(() => conversationRealtime.shutdown?.()),
        Promise.resolve().then(async () => {
          await getPrisma()?.$disconnect()
        }),
      ])
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("API resource cleanup failed")
      }
    },
    setExitCode: (code) => {
      process.exitCode = code
    },
    forceExit: (code) => process.exit(code),
    onComplete: () => {
      process.off("SIGTERM", onSigterm)
      process.off("SIGINT", onSigint)
    },
  })

  process.on("SIGTERM", onSigterm)
  process.on("SIGINT", onSigint)

  return { server, shutdown }
}
