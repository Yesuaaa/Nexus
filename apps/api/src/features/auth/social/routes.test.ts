import assert from "node:assert/strict"
import { test } from "node:test"
import type { AddressInfo } from "node:net"
import { createApp } from "../../../app.js"

test("social endpoints fail closed without configuration or valid requests", async () => {
  const saved = process.env.API_PUBLIC_URL
  delete process.env.API_PUBLIC_URL
  const server = createApp().listen(0)
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/social`
  try {
    const available = await fetch(`${base}/providers`)
    assert.equal(available.status, 200)
    assert.deepEqual(await available.json(), {
      providers: { google: false, facebook: false, apple: false },
    })
    assert.equal(available.headers.get("cache-control"), "no-store")
    const start = await fetch(`${base}/google/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verifierHash: "a".repeat(64) }),
    })
    assert.equal(start.status, 503)
    const unknown = await fetch(`${base}/github/start`, { method: "POST" })
    assert.equal(unknown.status, 400)
    const bad = await fetch(`${base}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "bad", verifier: "bad" }),
    })
    assert.equal(bad.status, 400)
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    if (saved === undefined) delete process.env.API_PUBLIC_URL
    else process.env.API_PUBLIC_URL = saved
  }
})
