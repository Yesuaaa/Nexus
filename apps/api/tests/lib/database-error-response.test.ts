import assert from "node:assert/strict"
import { test } from "node:test"
import express from "express"
import { serviceLogContext } from "../../src/features/service-operation-logs/log-context.js"
import { Prisma } from "../../src/generated/prisma/client.js"
import { readDatabase } from "../../src/lib/database-read.js"
import { handleError } from "../../src/shared/error-handler.js"
import { HttpError } from "../../src/shared/http-error.js"
import { closeServer, listen } from "../support/pglite-app.js"

const busy =
  "The database is temporarily busy or unavailable. Please try again."
const internal = "Internal server error"
const startDeadline = "Unable to start a transaction in the given time"
const checkoutTimeout = "timeout exceeded when trying to connect"
const sensitive =
  "SELECT secret FROM private_data at postgresql://user:secret@db"

function prismaError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  })
}

function pgPoolError(message: string, options?: ErrorOptions) {
  const error = new Error(message, options)
  error.stack = `Error: ${message}\n    at /workspace/node_modules/pg-pool/index.js:45:11`
  return error
}

test("database failures use the production HTTP error contract", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  })

  const cases = [
    {
      name: "observed Prisma transaction-start deadline",
      error: prismaError("P2028", `Transaction API error: ${startDeadline}.`),
      status: 503,
      message: busy,
    },
    {
      name: "bare transaction-start deadline through the existing read helper",
      error: prismaError("P2028", startDeadline),
      status: 503,
      message: busy,
      useReadHelper: true,
    },
    {
      name: "expired transaction",
      error: prismaError(
        "P2028",
        `Transaction already closed: an expired transaction. ${sensitive}`,
      ),
      status: 503,
      message: busy,
    },
    {
      name: "missing transaction",
      error: prismaError("P2028", `Transaction not found. ${sensitive}`),
      status: 500,
      message: internal,
    },
    {
      name: "P2028 with different transaction-start error",
      error: prismaError("P2028", `${startDeadline} for unknown reasons`),
      status: 500,
      message: internal,
    },
    {
      name: "unrecognized Prisma error with the same message",
      error: prismaError("P9999", startDeadline),
      status: 500,
      message: internal,
    },
    {
      name: "unrecognized connection error",
      error: new Error(sensitive),
      status: 500,
      message: internal,
    },
    {
      name: "pg-pool checkout timeout through the existing read helper",
      error: Object.assign(pgPoolError(checkoutTimeout), {
        clientVersion: Prisma.prismaVersion.client,
      }),
      status: 503,
      message: busy,
      useReadHelper: true,
    },
    {
      name: "the same message from outside pg-pool",
      error: new Error(checkoutTimeout),
      status: 500,
      message: internal,
    },
    {
      name: "a longer pg-pool message containing the checkout text",
      error: pgPoolError(`${checkoutTimeout}: ${sensitive}`),
      status: 500,
      message: internal,
    },
    {
      name: "a new connection timeout with a cause",
      error: pgPoolError("Connection terminated due to connection timeout", {
        cause: new Error(sensitive),
      }),
      status: 500,
      message: internal,
    },
    {
      name: "an unknown driver code with the same message",
      error: Object.assign(pgPoolError(checkoutTimeout), { code: "XX000" }),
      status: 500,
      message: internal,
    },
    {
      name: "Prisma serialization conflict",
      error: prismaError("P2034", sensitive),
      status: 409,
      message: "This record changed; refresh and retry",
    },
    {
      name: "business conflict",
      error: new HttpError(409, "This request has already been reviewed"),
      status: 409,
      message: "This request has already been reviewed",
    },
  ]

  const log = t.mock.method(console, "error", () => {})
  const attempts = new Map<string, number>()
  const app = express()
  const router = express.Router()
  app.use(serviceLogContext)
  for (const [index, scenario] of cases.entries()) {
    router.get(`/${index}`, async () => {
      const fail = async () => {
        attempts.set(scenario.name, (attempts.get(scenario.name) ?? 0) + 1)
        throw scenario.error
      }
      return scenario.useReadHelper ? readDatabase(fail) : fail()
    })
  }
  app.use("/api/test", router)
  app.use(handleError)
  const { server, origin } = await listen(app)
  t.after(() => closeServer(server))

  for (const [index, scenario] of cases.entries()) {
    await t.test(scenario.name, async () => {
      const before = log.mock.callCount()
      const response = await fetch(`${origin}/api/test/${index}`, {
        headers: { "X-Correlation-ID": "caller-provided-id" },
      })
      assert.equal(response.status, scenario.status)
      assert.deepEqual(await response.json(), { error: scenario.message })
      assert.equal(
        response.headers.get("Retry-After"),
        scenario.status === 503 ? "2" : null,
      )
      const correlationId = response.headers.get("X-Correlation-ID")
      assert.match(correlationId ?? "", /^[a-f0-9-]{36}$/)
      assert.equal(attempts.get(scenario.name), 1)
      const newLogs = log.mock.calls.slice(before)
      assert.equal(newLogs.length, scenario.status >= 500 ? 1 : 0)
      if (newLogs.length) {
        assert.deepEqual(newLogs[0].arguments.slice(0, 2), [
          "API request failed",
          {
            correlationId,
            endpoint: `GET /api/test/${index}`,
            status: scenario.status,
          },
        ])
      }
    })
  }
})
