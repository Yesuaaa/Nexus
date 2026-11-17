import assert from "node:assert/strict"
import { test } from "node:test"
import { runMobileReleaseSmoke } from "./smoke-mobile-release.mjs"

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": "request-safe-id",
    },
  })
}

function commonResponse(url, options) {
  const path = new URL(url).pathname
  const method = options.method ?? "GET"
  if (path === "/api/health") return json({ status: "ok" })
  if (path === "/api/auth/login") {
    const body = JSON.parse(options.body)
    return json({
      token: body.email.startsWith("head")
        ? "head-access-token"
        : "client-access-token",
      refreshToken: "refresh-token-that-must-not-be-logged",
    })
  }
  if (path === "/api/client/services")
    return json({
      services: [{ id: "service-1", isActive: true, packages: [] }],
    })
  if (path === "/api/auth/me") return json({ user: { id: "client-1" } })
  if (path === "/api/auth/profile") return json({ id: "client-1" })
  if (path === "/api/client/service-requests" && method === "GET")
    return json({ requests: [], total: 0, page: 1, pageSize: 10 })
  if (path === "/api/request-conversations") return json({ conversations: [] })
  if (path === "/api/project-conversations") return json({ conversations: [] })
  if (path === "/api/request-workflows/notifications")
    return json({ notifications: [], unreadCount: 0 })
  if (path === "/api/request-workflows/billing") return json([])
  if (path === "/api/projects") return json([])
  if (path === "/api/projects/calendar") return json([])
  return null
}

test("production smoke is read-only after authentication", async () => {
  const calls = []
  const output = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ path: new URL(url).pathname, method: options.method ?? "GET" })
    const response = commonResponse(url, options)
    if (!response)
      throw new Error(`Unexpected request ${options.method ?? "GET"} ${url}`)
    return response
  }

  await runMobileReleaseSmoke({
    env: {
      NEXUS_SMOKE_MODE: "production",
      NEXUS_SMOKE_BASE_URL: "http://smoke.example",
      NEXUS_SMOKE_ALLOW_HTTP: "true",
      NEXUS_SMOKE_CLIENT_EMAIL: "client@example.com",
      NEXUS_SMOKE_CLIENT_PASSWORD: "client-password-sentinel",
    },
    fetchImpl,
    log: (line) => output.push(line),
  })

  assert.ok(calls.length > 5)
  assert.deepEqual(
    calls.filter(({ method }) => method !== "GET"),
    [{ path: "/api/auth/login", method: "POST" }],
  )
  assert.equal(output.join("\n").includes("client-password-sentinel"), false)
  assert.equal(output.join("\n").includes("client-access-token"), false)
})

test("staging smoke exercises writes and cancels its tagged booking", async () => {
  const calls = []
  const output = []
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname
    const method = options.method ?? "GET"
    calls.push({ path, method, body: options.body })
    const common = commonResponse(url, options)
    if (common) return common
    if (path === "/api/client/services/service-1")
      return json({ service: { id: "service-1", packages: [] } })
    if (path === "/api/client/service-requests" && method === "POST")
      return json({ serviceRequest: { id: "booking-1" } }, 201)
    if (path === "/api/request-inbox/booking-1/accept" && method === "POST")
      return json({ serviceRequest: { id: "booking-1" } })
    if (path === "/api/request-conversations/booking-1/events")
      return new Response("event: connected\ndata: {}\n\n", {
        headers: { "x-request-id": "request-safe-id" },
      })
    if (
      path === "/api/request-conversations/booking-1/messages" &&
      method === "POST"
    )
      return json({ message: { id: "message-1" } }, 201)
    if (path === "/api/request-workflows/booking-1/files" && method === "POST")
      return json({ file: { id: "file-1" } }, 201)
    if (path === "/api/request-workflows/booking-1/files/file-1")
      return new Response("Nexus mobile release smoke", {
        headers: { "x-request-id": "request-safe-id" },
      })
    if (path === "/api/projects/project-1") return json({ id: "project-1" })
    if (path === "/api/request-workflows/booking-1" && method === "GET")
      return json({ version: 2 })
    if (
      path === "/api/request-workflows/booking-1/actions" &&
      method === "POST"
    )
      return json({ state: "CANCELLED", version: 3 })
    throw new Error(`Unexpected request ${method} ${path}`)
  }

  await runMobileReleaseSmoke({
    env: {
      NEXUS_SMOKE_MODE: "staging",
      NEXUS_SMOKE_BASE_URL: "http://smoke.example",
      NEXUS_SMOKE_ALLOW_HTTP: "true",
      NEXUS_SMOKE_CLIENT_EMAIL: "client@example.com",
      NEXUS_SMOKE_CLIENT_PASSWORD: "client-password-sentinel",
      NEXUS_SMOKE_HEAD_EMAIL: "head@example.com",
      NEXUS_SMOKE_HEAD_PASSWORD: "head-password-sentinel",
      NEXUS_SMOKE_PROJECT_ID: "project-1",
    },
    fetchImpl,
    log: (line) => output.push(line),
  })

  for (const expected of [
    "/api/client/service-requests",
    "/api/request-inbox/booking-1/accept",
    "/api/request-conversations/booking-1/events",
    "/api/request-conversations/booking-1/messages",
    "/api/request-workflows/booking-1/files",
    "/api/request-workflows/booking-1/files/file-1",
    "/api/request-workflows/booking-1/actions",
  ])
    assert.ok(
      calls.some(({ path }) => path === expected),
      expected,
    )

  const cancellation = calls.find(
    ({ path, method }) =>
      path === "/api/request-workflows/booking-1/actions" && method === "POST",
  )
  assert.equal(JSON.parse(cancellation.body).type, "CANCEL")
  const logs = output.join("\n")
  for (const secret of [
    "client-password-sentinel",
    "head-password-sentinel",
    "client-access-token",
    "head-access-token",
    "refresh-token-that-must-not-be-logged",
  ])
    assert.equal(logs.includes(secret), false)
})
