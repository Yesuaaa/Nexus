import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { createApp } from "./app.js"

test("API routes and error responses remain available", async () => {
  const databaseUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
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

    const database = await fetch(`${base}/api/db-check`)
    assert.equal(database.status, 503)
    assert.deepEqual(await database.json(), {
      status: "unavailable",
      message: "DATABASE_URL is not configured",
    })

    const login = await fetch(`${base}/api/auth/login`, { method: "POST" })
    assert.equal(login.status, 503)
    assert.equal(login.headers.get("cache-control"), "no-store")
    assert.deepEqual(await login.json(), { error: "Database unavailable" })

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
    assert.deepEqual(await malformed.json(), { error: "Invalid JSON" })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if (databaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = databaseUrl
  }
})
