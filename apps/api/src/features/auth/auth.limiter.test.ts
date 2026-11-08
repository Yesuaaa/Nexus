import assert from "node:assert/strict"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import express from "express"
import { authRouter } from "./auth.controller.js"

test("auth routes enforce their production and development HTTP limits", async (t) => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
  }
  delete process.env.DATABASE_URL
  delete process.env.DIRECT_URL
  // Forwarded addresses are trusted only by this isolated test application.
  const app = express()
  app.set("trust proxy", true)
  app.use(express.json(), authRouter)
  const server = app.listen(0, "127.0.0.1")
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  for (const [environment, registerLimit, loginLimit, address] of [
    ["production", 10, 60, "127.0.0.2"],
    ["development", 50, 300, "127.0.0.3"],
    ["test", 10, 60, "127.0.0.4"],
  ] as const) {
    await t.test(environment, async () => {
      process.env.NODE_ENV = environment
      for (const [path, limit] of [
        ["register", registerLimit],
        ["login", loginLimit],
        ["refresh", 120],
      ] as const) {
        const request = (source: string = address) =>
          fetch(`${base}/${path}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-forwarded-for": source,
            },
            body: "{}",
          })
        for (let attempt = 0; attempt < limit; attempt++) {
          const response = await request()
          // A 503 proves the request passed the limiter without a live database.
          assert.equal(response.status, 503, `${path}: attempt ${attempt + 1}`)
          await response.json()
        }
        const blocked = await request()
        assert.equal(blocked.status, 429, `${path}: first request above limit`)
        assert.ok(Number(blocked.headers.get("retry-after")) > 0)
        assert.match(
          ((await blocked.json()) as { error: string }).error,
          /Too many requests/,
        )
        const otherSource = await request(`${address}0`)
        assert.equal(otherSource.status, 503, "another source is not blocked")
        await otherSource.json()
      }
    })
  }
})
