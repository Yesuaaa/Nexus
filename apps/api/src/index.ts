import "dotenv/config"
import cors from "cors"
import express, { type ErrorRequestHandler } from "express"
import { getPrisma } from "./db.js"
import { authRouter } from "./auth.js"

const app = express()
const port = Number(process.env.PORT || 3001)
app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" }))
app.use(express.json({ limit: "16kb" }))
app.use("/api", authRouter)

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" })
})

app.get("/api/db-check", async (_request, response) => {
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
app.use(handleError)

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
