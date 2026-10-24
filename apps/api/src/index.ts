import "dotenv/config"
import cors from "cors"
import express from "express"
import { getPrisma } from "./db.js"

const app = express()
const port = Number(process.env.PORT || 3001)
app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:5173" }))

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

app.listen(port, () => console.log(`API listening on http://localhost:${port}`))
