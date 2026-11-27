import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { startPgliteApp } from "./pglite-app.js"
import { seedPg018, calendarSnapshot } from "./pg018-calendar-fixture.js"

test(
  "PG018 isolated calendar browser server",
  { timeout: 1800000 },
  async (t) => {
    const { prisma, origin, beforeShutdown } = await startPgliteApp(t)
    const fixture = await seedPg018(prisma)
    const secret = randomBytes(24).toString("hex")
    const snapshot = () => calendarSnapshot(prisma)
    const before = await snapshot()
    const control = createServer(async (req, res) => {
      if (req.headers["x-pg018-fixture"] !== secret) {
        res.writeHead(403).end()
        return
      }
      if (req.url !== "/snapshot") {
        res.writeHead(404).end()
        return
      }
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify(await snapshot()))
    })
    await new Promise<void>((resolve) =>
      control.listen(0, "127.0.0.1", resolve),
    )
    beforeShutdown(
      () =>
        new Promise<void>((resolve) => {
          control.close(() => resolve())
          control.closeAllConnections()
        }),
    )
    const address = control.address()
    if (!address || typeof address === "string")
      throw new Error("Missing control address")
    console.log(
      "PG018_READY:" +
        JSON.stringify({
          origin,
          control: "http://127.0.0.1:" + address.port,
          secret,
          before,
          ...fixture,
        }),
    )
    await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
  },
)
