import assert from "node:assert/strict"
import {
  createServer as createTcpServer,
  type AddressInfo,
  type Socket,
} from "node:net"
import { test } from "node:test"
import { createApp } from "../src/app.js"
import { getPrisma } from "../src/lib/db.js"

test("API routes and error responses remain available", async () => {
  const databaseUrl = process.env.DATABASE_URL
  const directUrl = process.env.DIRECT_URL
  const databaseProbeSockets: Socket[] = []
  const databaseProbe = createTcpServer((socket) =>
    databaseProbeSockets.push(socket),
  )
  delete process.env.DATABASE_URL
  delete process.env.DIRECT_URL
  const server = createApp().listen(0)

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve))
    const address = server.address() as AddressInfo
    const base = `http://127.0.0.1:${address.port}`

    const health = await fetch(`${base}/api/health`)
    assert.equal(health.status, 200)
    assert.equal(health.headers.get("cache-control"), "no-store")
    assert.equal(health.headers.get("x-content-type-options"), "nosniff")
    assert.equal(health.headers.has("x-powered-by"), false)
    assert.deepEqual(await health.json(), { status: "ok" })

    const readiness = await fetch(`${base}/api/ready`)
    assert.equal(readiness.status, 503)
    assert.deepEqual(await readiness.json(), { status: "unavailable" })

    const database = await fetch(`${base}/api/db-check`)
    assert.equal(database.status, 503)
    assert.deepEqual(await database.json(), {
      status: "unavailable",
      message: "DATABASE_URL is not configured",
    })

    const login = await fetch(`${base}/api/auth/login`, { method: "POST" })
    assert.equal(login.status, 503)
    assert.equal(login.headers.get("cache-control"), "no-store")
    assert.equal(
      ((await login.json()) as { error: string }).error,
      "Database unavailable",
    )

    const users = await fetch(`${base}/api/users`)
    assert.equal(users.status, 503)
    assert.equal(users.headers.get("cache-control"), "no-store")

    const services = await fetch(`${base}/api/services`)
    assert.equal(services.status, 503)
    assert.equal(services.headers.get("cache-control"), "no-store")

    const malformed = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    })
    assert.equal(malformed.status, 400)
    assert.equal(
      ((await malformed.json()) as { error: string }).error,
      "Invalid JSON",
    )

    await new Promise<void>((resolve) =>
      databaseProbe.listen(0, "127.0.0.1", resolve),
    )
    const databaseProbePort = (databaseProbe.address() as AddressInfo).port
    process.env.DATABASE_URL =
      `postgresql://user:secret@127.0.0.1:${databaseProbePort}/test`
    const timedReadiness = await fetch(`${base}/api/ready`, {
      signal: AbortSignal.timeout(8_000),
    })
    assert.equal(timedReadiness.status, 503)
    assert.equal(
      JSON.stringify(await timedReadiness.json()).includes("secret"),
      false,
    )
  } finally {
    databaseProbeSockets.forEach((socket) => socket.destroy())
    if (databaseProbe.listening) {
      await new Promise<void>((resolve, reject) =>
        databaseProbe.close((error) => (error ? reject(error) : resolve())),
      )
    }
    await getPrisma()?.$disconnect()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if (databaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = databaseUrl
    if (directUrl === undefined) delete process.env.DIRECT_URL
    else process.env.DIRECT_URL = directUrl
  }
})
