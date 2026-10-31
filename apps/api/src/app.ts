import cors from "cors"
import express, { type ErrorRequestHandler } from "express"
import { authRouter } from "./features/auth/auth.controller.js"
import { departmentsRouter } from "./features/departments/departments.controller.js"
import { employeesRouter } from "./features/employees/employees.controller.js"
import { healthRouter } from "./features/health/health.controller.js"
import { usersRouter } from "./features/users/users.controller.js"
import { servicesRouter } from "./features/services/services.controller.js"
import { clientsRouter } from "./features/clients/clients.controller.js"
import { clientServicesRouter } from "./features/client-services/client-services.controller.js"
import { serviceRequestsRouter } from "./features/service-requests/service-requests.controller.js"
import { requestInboxRouter } from "./features/request-inbox/request-inbox.controller.js"
import { createRequestConversationsRouter } from "./features/request-conversations/request-conversations.controller.js"
import type { ConversationRealtime } from "./features/request-conversations/request-conversations.realtime.js"
import { requestWorkflowRouter } from "./features/request-workflow/workflow.controller.js"
import { projectsRouter } from "./features/projects/projects.controller.js"

export function createApp(
  options: { conversationRealtime?: ConversationRealtime } = {},
) {
  const app = express()
  app.disable("x-powered-by")
  app.use(securityHeaders)
  app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" }))
  app.use("/api", noStore)
  app.use("/api/services", servicesRouter)
  app.use(
    "/api/service-requests",
    express.json({ limit: "64kb" }),
    serviceRequestsRouter,
  )
  app.use("/api/client", express.json({ limit: "64kb" }), clientServicesRouter)
  app.use("/api/request-workflows", requestWorkflowRouter)
  app.use(express.json({ limit: "16kb" }))
  app.use("/api/auth", authRouter)
  app.use("/api/users", usersRouter)
  app.use("/api/departments", departmentsRouter)
  app.use("/api/employees", employeesRouter)
  app.use("/api/clients", clientsRouter)
  app.use("/api/request-inbox", requestInboxRouter)
  app.use("/api/projects", projectsRouter)
  app.use(
    "/api/request-conversations",
    createRequestConversationsRouter(options.conversationRealtime),
  )
  app.use("/api", healthRouter)
  app.use(handleError)
  return app
}

const securityHeaders: express.RequestHandler = (_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff")
  next()
}

const noStore: express.RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store")
  next()
}

const handleError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next
  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    response.status(400).json({ error: "Invalid JSON" })
    return
  }
  if (error instanceof Error && "status" in error && error.status === 413) {
    response.status(413).json({ error: "Request payload is too large" })
    return
  }
  console.error("API request failed:", error)
  response.status(500).json({ error: "Internal server error" })
}
