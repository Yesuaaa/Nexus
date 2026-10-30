import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getCurrentAccount,
  getToken,
  signIn,
  signOut,
  clearToken,
  apiRequest,
} from "../src/features/auth/api/auth-api.ts"

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
        refreshToken: "refresh-token",
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
  assert.equal(values.get("nexus.auth.refreshToken"), "refresh-token")
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
  assert.equal(values.has("nexus.auth.refreshToken"), false)
})

test("a delayed refresh cannot restore a signed-out session", async (t) => {
  const values = new Map([
    ["nexus.auth.token", "expired"],
    ["nexus.auth.refreshToken", "refresh"],
  ])
  const descriptor = Object.getOwnPropertyDescriptor(
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
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else delete globalThis.sessionStorage
  })
  let release
  let started
  const refreshStarted = new Promise((resolve) => {
    started = resolve
  })
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "/api/auth/refresh") {
      started()
      await new Promise((resolve) => {
        release = resolve
      })
      return Response.json({
        token: "fresh",
        refreshToken: "rotated",
        expiresIn: 900,
      })
    }
    return Response.json(
      { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      { status: 401 },
    )
  })
  const pending = getCurrentAccount()
  await refreshStarted
  clearToken()
  release()
  await assert.rejects(pending, (error) => error.status === 409)
  assert.equal(values.size, 0)
})

test("an old mutation is never replayed under a newly signed-in account", async (t) => {
  const values = new Map([
    ["nexus.auth.token", "account-a"],
    ["nexus.auth.refreshToken", "refresh-a"],
  ])
  const descriptor = Object.getOwnPropertyDescriptor(
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
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else delete globalThis.sessionStorage
  })
  let release
  let started
  let mutations = 0
  const requestStarted = new Promise((resolve) => {
    started = resolve
  })
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "/api/auth/login")
      return Response.json({
        token: "account-b",
        refreshToken: "refresh-b",
        expiresIn: 900,
        user: { id: "b" },
      })
    mutations++
    started()
    await new Promise((resolve) => {
      release = resolve
    })
    return Response.json(
      { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      { status: 401 },
    )
  })
  const pending = apiRequest("/api/example", { method: "DELETE" })
  await requestStarted
  clearToken()
  await signIn("b@example.com", "password")
  release()
  await assert.rejects(pending, (error) => error.status === 409)
  assert.equal(mutations, 1)
  assert.equal(getToken(), "account-b")
  assert.equal(values.get("nexus.auth.refreshToken"), "refresh-b")
})

test("response bodies and earlier login attempts cannot overwrite a newer session", async (t) => {
  const values = new Map([
    ["nexus.auth.token", "account-a"],
    ["nexus.auth.refreshToken", "refresh-a"],
  ])
  const descriptor = Object.getOwnPropertyDescriptor(
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
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else delete globalThis.sessionStorage
  })
  for (const scenario of ["profile", "login", "error"]) {
    let release
    let started
    const bodyStarted = new Promise((resolve) => {
      started = resolve
    })
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      const isNewLogin =
        url === "/api/auth/login" &&
        JSON.parse(options.body).email === "b@example.com"
      if (isNewLogin)
        return Response.json({
          token: "account-b",
          refreshToken: "refresh-b",
          expiresIn: 900,
          user: { id: "b" },
        })
      const response = Response.json(
        {},
        { status: scenario === "error" ? 401 : 200 },
      )
      t.mock.method(response, "json", async () => {
        started()
        await new Promise((resolve) => {
          release = resolve
        })
        return scenario === "login"
          ? {
              token: "account-a",
              refreshToken: "refresh-a",
              expiresIn: 900,
              user: { id: "a" },
            }
          : scenario === "error"
            ? { error: "Invalid session" }
            : { user: { id: "a" } }
      })
      return response
    })
    const pending =
      scenario === "login"
        ? signIn("a@example.com", "password")
        : getCurrentAccount()
    await bodyStarted
    await signIn("b@example.com", "password")
    release()
    await assert.rejects(pending, (error) => error.status === 409)
    assert.equal(getToken(), "account-b")
    mock.mock.restore()
  }
})

test("a refresh body cannot change storage after another login attempt starts", async (t) => {
  const values = new Map([
    ["nexus.auth.token", "expired"],
    ["nexus.auth.refreshToken", "original-refresh"],
  ])
  const descriptor = Object.getOwnPropertyDescriptor(
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
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else delete globalThis.sessionStorage
  })
  let release
  let started
  const bodyStarted = new Promise((resolve) => {
    started = resolve
  })
  t.mock.method(globalThis, "fetch", async (url) => {
    if (url === "/api/auth/login")
      return Response.json({ error: "Wrong password" }, { status: 401 })
    if (url === "/api/auth/refresh") {
      const response = Response.json({})
      t.mock.method(response, "json", async () => {
        started()
        await new Promise((resolve) => {
          release = resolve
        })
        return {
          token: "late-fresh",
          refreshToken: "late-rotated",
          expiresIn: 900,
        }
      })
      return response
    }
    return Response.json(
      { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      { status: 401 },
    )
  })
  const pending = getCurrentAccount()
  await bodyStarted
  await assert.rejects(
    signIn("b@example.com", "wrong"),
    (error) => error.status === 401,
  )
  release()
  await assert.rejects(pending, (error) => error.status === 409)
  assert.equal(getToken(), "expired")
  assert.equal(values.get("nexus.auth.refreshToken"), "original-refresh")
})

test("concurrent expired requests share a refresh and retry once", async (t) => {
  const values = new Map([
    ["nexus.auth.token", "expired"],
    ["nexus.auth.refreshToken", "original-refresh"],
  ])
  const descriptor = Object.getOwnPropertyDescriptor(
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
    if (descriptor)
      Object.defineProperty(globalThis, "sessionStorage", descriptor)
    else delete globalThis.sessionStorage
  })
  let refreshes = 0
  let refreshStatus = 200
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === "/api/auth/refresh") {
      refreshes++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return Response.json(
        refreshStatus === 200
          ? { token: "fresh", refreshToken: "rotated", expiresIn: 900 }
          : { error: "Unavailable" },
        { status: refreshStatus },
      )
    }
    if (options.headers.get("Authorization") === "Bearer fresh")
      return Response.json({ user: { id: "user-1" } })
    return Response.json(
      { error: "Expired", code: "ACCESS_TOKEN_EXPIRED" },
      { status: 401 },
    )
  })
  const result = await Promise.all([
    getCurrentAccount(),
    getCurrentAccount(),
    getCurrentAccount(),
  ])
  assert.equal(refreshes, 1)
  assert.equal(result.length, 3)
  assert.equal(values.get("nexus.auth.refreshToken"), "rotated")
  values.set("nexus.auth.token", "expired")
  refreshStatus = 503
  await assert.rejects(getCurrentAccount(), (error) => error.status === 503)
  assert.equal(getToken(), "expired")
  assert.equal(values.get("nexus.auth.refreshToken"), "rotated")
  refreshStatus = 401
  await assert.rejects(getCurrentAccount(), (error) => error.status === 401)
  assert.equal(getToken(), null)
  assert.equal(values.has("nexus.auth.refreshToken"), false)
})
