import assert from "node:assert/strict"
import { test } from "node:test"
import {
  completeSocialAuth,
  getSocialConnections,
  getSocialProviders,
  sendSocialEmailCode,
  startSocialAuth,
} from "../src/features/auth/api/auth-api.ts"

test("social auth stores its PKCE verifier before starting and sends it only as a hash", async (t) => {
  const values = new Map()
  const requests = []
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
    if (storageDescriptor)
      Object.defineProperty(globalThis, "sessionStorage", storageDescriptor)
    else delete globalThis.sessionStorage
  })
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options })
    return Response.json({ url: "https://identity.example/authorize" })
  })

  const result = await startSocialAuth("google")
  const body = JSON.parse(requests[0].options.body)
  const saved = JSON.parse(values.get("nexus.auth.social.pending"))

  assert.equal(result.url, "https://identity.example/authorize")
  assert.match(saved.verifier, /^[A-Za-z0-9_-]{43}$/)
  assert.match(body.verifierHash, /^[a-f0-9]{64}$/)
  assert.notEqual(body.verifierHash, saved.verifier)
  assert.equal(requests[0].url, "/api/auth/social/google/start")
})

test("social auth endpoints use the response types and authenticated connection request", async (t) => {
  const requests = []
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    requests.push({ url, options })
    if (url === "/api/auth/social/providers") {
      return Response.json({
        providers: { google: true, facebook: false, apple: true },
      })
    }
    if (url === "/api/auth/social/connections") {
      return Response.json({ providers: ["google"], hasPassword: false })
    }
    if (url === "/api/auth/social/email") return Response.json({ sent: true })
    return Response.json({ onboarding: true, emailRequired: true })
  })

  assert.deepEqual(await getSocialProviders(), {
    google: true,
    facebook: false,
    apple: true,
  })
  assert.deepEqual(await getSocialConnections(), {
    providers: ["google"],
    hasPassword: false,
  })
  assert.deepEqual(
    await completeSocialAuth({ code: "one", verifier: "secret" }),
    {
      onboarding: true,
      emailRequired: true,
    },
  )
  await sendSocialEmailCode("one", "secret", "jane@example.com")

  assert.equal(requests[1].options.headers.get("Authorization"), null)
  assert.equal(requests[2].options.headers.get("Authorization"), null)
  assert.deepEqual(JSON.parse(requests[2].options.body), {
    code: "one",
    verifier: "secret",
  })
  assert.deepEqual(JSON.parse(requests[3].options.body), {
    code: "one",
    verifier: "secret",
    email: "jane@example.com",
  })
})
