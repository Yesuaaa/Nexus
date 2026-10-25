import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getCurrentAccount,
  getToken,
  signIn,
  signOut,
} from "../src/features/auth/api.ts"

test("sign-in stores its session and authenticated requests send one bearer token", async (t) => {
  const values = new Map()
  const account = {
    id: "user-1",
    email: "jane@example.com",
    fullName: "Jane Doe",
    contactNumber: null,
    role: "USER",
    permissions: ["dashboard:read", "profile:read", "profile:change-password"],
    createdAt: "2026-01-01T00:00:00.000Z",
  }
  const requests = []

  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options })
    if (url === "/api/auth/login") {
      return Response.json({
        token: "session-token",
        user: account,
        expiresIn: 60,
      })
    }
    if (url === "/api/auth/me") return Response.json({ user: account })
    return new Response(null, { status: 204 })
  })
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  )
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  })
  t.after(() => {
    if (storageDescriptor) {
      Object.defineProperty(globalThis, "sessionStorage", storageDescriptor)
    } else {
      delete globalThis.sessionStorage
    }
  })

  assert.deepEqual(
    await signIn(account.email, "correct horse battery staple"),
    account,
  )
  assert.equal(getToken(), "session-token")
  assert.equal(
    requests[0].options.headers.get("Content-Type"),
    "application/json",
  )
  assert.equal(requests[0].options.headers.has("Authorization"), false)

  assert.deepEqual(await getCurrentAccount(), { user: account })
  assert.equal(
    requests[1].options.headers.get("Authorization"),
    "Bearer session-token",
  )

  await signOut()
  assert.equal(
    requests[2].options.headers.get("Authorization"),
    "Bearer session-token",
  )
  assert.equal(getToken(), null)
})
