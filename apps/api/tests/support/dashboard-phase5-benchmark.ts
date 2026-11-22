import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"
import { test } from "node:test"
import pg from "pg"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { listClientOutstandingActions } from "../../src/features/request-workflow/workflow.client-actions.js"
import { startPgliteApp } from "./pglite-app.js"

test(
  "outstanding action baseline on isolated records",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const seedUser = (name: string, role: "USER" | "STAFF") =>
      prisma.user.create({
        data: {
          id: name,
          email: name + "@example.test",
          fullName: name,
          passwordHash: "test",
          role,
        },
      })
    const owner = await seedUser("baseline-owner", "USER")
    const foreign = await seedUser("baseline-foreign", "USER")
    const head = await seedUser("baseline-head", "STAFF")
    const department = await prisma.department.create({
      data: { name: "Baseline Department", headId: head.id },
    })
    const service = await prisma.service.create({
      data: { name: "Baseline Service", description: "Isolated fixture" },
    })
    const token = (await issueSession(owner)).token
    async function add(
      prefix: string,
      clientId: string,
      from: number,
      to: number,
    ) {
      const ids = Array.from(
        { length: to - from },
        (_, index) => prefix + (index + from),
      )
      await prisma.serviceRequest.createMany({
        data: ids.map((id) => ({
          id,
          clientId,
          serviceId: service.id,
          title: id,
          acceptedDepartmentId: department.id,
        })),
      })
      await prisma.requestWorkflow.createMany({
        data: ids.map((requestId) => ({ requestId, state: "CONSULTATION" })),
      })
      await prisma.workflowRequirement.createMany({
        data: ids.map((requestId) => ({
          requestId,
          title: "Submit project information",
        })),
      })
    }
    await add("foreign-", foreign.id, 0, 10)
    const original = pg.Client.prototype.query
    let queries = 0,
      databaseMs = 0
    pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
      const start = performance.now()
      queries++
      const result: unknown = Reflect.apply(original, this, args)
      if (result instanceof Promise)
        return result.finally(() => {
          databaseMs += performance.now() - start
        })
      return result
    } as typeof original
    t.after(() => {
      pg.Client.prototype.query = original
    })
    let previous = 0
    const median = (values: number[]) =>
      values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!
    for (const size of [25, 100, 500, 1000]) {
      await add("owner-", owner.id, previous, size)
      previous = size
      await listClientOutstandingActions(owner.id, 1)
      const serviceTimes: number[] = [],
        dbTimes: number[] = [],
        serialization: number[] = [],
        http: number[] = []
      const queryCounts: number[] = []
      for (let repeat = 0; repeat < 5; repeat++) {
        queries = 0
        databaseMs = 0
        const start = performance.now()
        const result = await listClientOutstandingActions(owner.id, 1)
        serviceTimes.push(performance.now() - start)
        queryCounts.push(queries)
        dbTimes.push(databaseMs)
        const jsonStart = performance.now()
        JSON.stringify(result)
        serialization.push(performance.now() - jsonStart)
        assert.equal(result.total, size)
        assert.equal(result.actions.length, 10)
        assert.ok(
          result.actions.every((item) => item.requestId?.startsWith("owner-")),
        )
        const httpStart = performance.now()
        const response = await fetch(
          base + "/request-workflows/outstanding-actions?page=2",
          { headers: { authorization: "Bearer " + token } },
        )
        const page = (await response.json()) as typeof result
        http.push(performance.now() - httpStart)
        assert.equal(response.status, 200)
        assert.equal(page.total, size)
        assert.equal(page.actions.length, 10)
        assert.equal(
          new Set([...result.actions, ...page.actions].map((item) => item.id))
            .size,
          20,
        )
      }
      console.log(
        JSON.stringify({
          size,
          queries: [...new Set(queryCounts)],
          databaseMs: median(dbTimes),
          serviceMs: median(serviceTimes),
          serializeMs: median(serialization),
          httpMs: median(http),
        }),
      )
    }
  },
)
