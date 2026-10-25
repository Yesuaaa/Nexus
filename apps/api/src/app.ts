import cors from "cors"
import express, { type ErrorRequestHandler } from "express"
import { authRouter } from "./features/auth/routes.js"
import { departmentsRouter } from "./features/departments/routes.js"
import { healthRouter } from "./features/health/routes.js"
import { usersRouter } from "./features/users/routes.js"

export function createApp() {
  const app = express()
  app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" }))
  app.use(express.json({ limit: "16kb" }))
  app.use("/api", noStore)
  app.use("/api/auth", authRouter)
  app.use("/api/users", usersRouter)
  app.use("/api/departments", departmentsRouter)
  app.use("/api", healthRouter)
  app.use(handleError)
  return app
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
  console.error("API request failed:", error)
  response.status(500).json({ error: "Internal server error" })
}
