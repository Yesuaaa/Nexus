import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { startPgliteApp } from "./pglite-app.js"
import { seedBilling } from "./pg016-billing-fixture.js"

test(
  "PG-016 isolated browser billing server",
  { timeout: 1800000 },
  async (t) => {
    const { prisma, origin, beforeShutdown } = await startPgliteApp(t)
    const seeded = await seedBilling(prisma)
    const secret = randomBytes(24).toString("hex")
    const snapshot = async () => ({
      payments: await prisma.workflowPayment.findMany({
        orderBy: { id: "asc" },
      }),
      workflows: await prisma.requestWorkflow.findMany({
        orderBy: { requestId: "asc" },
      }),
      files: (
        await prisma.workflowFile.findMany({ orderBy: { id: "asc" } })
      ).map(({ data, ...file }) => ({
        ...file,
        bytes: Buffer.from(data).toString("base64"),
      })),
    })
    const before = await snapshot()
    const control = createServer(async (req, res) => {
      if (req.headers["x-pg016-fixture"] !== secret) {
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
      "PG016_READY:" +
        JSON.stringify({
          origin,
          control: "http://127.0.0.1:" + address.port,
          secret,
          before,
          a: seeded.a,
          b: seeded.b,
          own: seeded.own,
          foreign: seeded.foreign,
        }),
    )
    await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
  },
)
