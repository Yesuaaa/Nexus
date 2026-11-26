import { createServer } from "node:http"
import { test } from "node:test"
import { startPgliteApp } from "./pglite-app.js"
import { seedPg019 } from "./pg019-client-fixture.js"

test("PG020 disposable rewrite upstream", { timeout: 1800000 }, async (t) => {
  const { prisma, origin, beforeShutdown } = await startPgliteApp(t)
  const { a, b, records } = await seedPg019(prisma)
  for (const [index, record] of records.entries()) {
    await prisma.requestWorkflow.create({
      data: { requestId: record.request.id },
    })
    for (const internal of [false, true]) {
      const event = await prisma.workflowEvent.create({
        data: {
          requestId: record.request.id,
          type: "REQUEST_ACCEPTED",
          summary:
            index === 0 && !internal
              ? "PG020 public own notice"
              : "PG020 private sentinel",
          internal,
        },
      })
      await prisma.workflowNotification.create({
        data: {
          requestId: record.request.id,
          eventId: event.id,
          userId: a.user.id,
        },
      })
    }
  }
  const reads: string[] = []
  const upstream = createServer(async (req, res) => {
    if (req.url === "/__pg020") {
      res.setHeader("content-type", "application/json")
      res.end(
        JSON.stringify({
          token: a.token,
          actor: a.user.id,
          other: b.user.id,
          reads,
          notices: await prisma.workflowNotification.findMany({
            orderBy: { id: "asc" },
          }),
        }),
      )
      return
    }
    reads.push(`${req.method} ${req.url}`)
    try {
      const response = await fetch(origin + req.url, {
        headers: { authorization: String(req.headers.authorization ?? "") },
      })
      res.writeHead(response.status, {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      })
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      res.writeHead(502).end()
    }
  })
  await new Promise<void>((resolve) =>
    upstream.listen(5274, "127.0.0.1", resolve),
  )
  beforeShutdown(
    () =>
      new Promise<void>((resolve) => {
        upstream.close(() => resolve())
        upstream.closeAllConnections()
      }),
  )
  await new Promise<void>((resolve) => process.once("SIGTERM", resolve))
})
