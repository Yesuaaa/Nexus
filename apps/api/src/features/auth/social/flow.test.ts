import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { resolve, join } from "node:path"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { createApp } from "../../../app.js"
import { getPrisma } from "../../../lib/db.js"
import { clearFailures } from "../login-limiter.js"
import { hashPassword } from "../password.js"
import { issueSession } from "../session.js"
import { digest } from "./policy.js"

test("social API exchanges are browser-bound, atomic, and preserve account ownership", async (t) => {
  const db = await PGlite.create()
  for (const migration of (
    await readdir(resolve("prisma/migrations"))
  ).sort()) {
    if (migration === "migration_lock.toml") continue
    await db.exec(
      await readFile(
        join("prisma/migrations", migration, "migration.sql"),
        "utf8",
      ),
    )
  }
  const socket = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 })
  await socket.start()
  const port = Number(socket.getServerConn().split(":").at(-1))
  const saved = { ...process.env }
  Object.assign(process.env, {
    DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
    DATABASE_POOL_MAX: "1",
    API_PUBLIC_URL: "https://api.example.test",
    WEB_ORIGIN: "https://example.test",
    FACEBOOK_APP_ID: "facebook-app",
    FACEBOOK_APP_SECRET: "facebook-secret",
    RESEND_API_KEY: "test-only",
    EMAIL_FROM: "EXP <auth@example.test>",
  })
  const prisma = getPrisma()!
  const server = createApp().listen(0, "127.0.0.1")
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const originalFetch = globalThis.fetch
  let subject = "facebook-subject",
    providerFailure = false,
    emailCode = ""
  t.mock.method(
    globalThis,
    "fetch",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith("https://graph.facebook.com/")) {
        if (providerFailure)
          return Response.json(
            { error: { message: "secret-provider-error" } },
            { status: 500 },
          )
        if (url.includes("/oauth/access_token"))
          return Response.json({ access_token: "provider-token" })
        if (url.includes("/debug_token"))
          return Response.json({
            data: {
              app_id: "facebook-app",
              user_id: subject,
              is_valid: true,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          })
        return Response.json({
          id: subject,
          name: "Social Person",
          email: "provider@example.test",
        })
      }
      if (url === "https://api.resend.com/emails") {
        const payload = JSON.parse(String(init?.body))
        emailCode = /\b\d{8}\b/.exec(payload.text)![0]
        return Response.json({ id: "test-email" })
      }
      return originalFetch(input, init)
    },
  )
  const verifier = "a".repeat(43)
  const post = (path: string, body: unknown, token?: string) =>
    fetch(`${base}/api/auth/social${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  async function begin(
    purpose = "signin",
    token?: string,
    currentPassword?: string,
  ) {
    const response = await post(
      "/facebook/start",
      { verifierHash: digest(verifier), purpose, currentPassword },
      token,
    )
    assert.equal(response.status, 200)
    const { url } = (await response.json()) as { url: string }
    return new URL(url).searchParams.get("state")!
  }
  async function callback(state: string, error?: string) {
    const params = new URLSearchParams({
      state,
      ...(error ? { error } : { code: "provider-code" }),
    })
    const response = await fetch(
      `${base}/api/auth/social/facebook/callback?${params}`,
      { redirect: "manual" },
    )
    assert.equal(response.status, 303)
    return new URLSearchParams(
      new URL(response.headers.get("location")!).hash.slice(1),
    )
  }
  async function reset() {
    for (const op of ["start", "callback", "complete", "email"])
      clearFailures(`social:${op}:127.0.0.1`)
    await prisma.$executeRawUnsafe(
      'TRUNCATE "SocialCompletion", "OAuthAttempt", "SocialIdentity", "Session", "User" CASCADE',
    )
    subject = "facebook-subject"
    providerFailure = false
  }
  try {
    await t.test(
      "new user verifies email, gets a protected EXP session and can sign out",
      async () => {
        const state = await begin()
        const result = await callback(state)
        const code = result.get("code")!
        assert.ok(code)
        assert.equal(await prisma.user.count(), 0)
        assert.equal(await prisma.session.count(), 0)
        const stored = await prisma.socialCompletion.findUniqueOrThrow({
          where: { id: digest(code) },
        })
        assert.notEqual(stored.id, code)
        assert.equal(
          (await post("/complete", { code, verifier: "b".repeat(43) })).status,
          400,
        )
        const onboarding = await post("/complete", { code, verifier })
        assert.deepEqual(await onboarding.json(), {
          onboarding: true,
          emailRequired: true,
          fullName: "Social Person",
        })
        const sent = await post("/email", {
          code,
          verifier,
          email: "new@example.test",
        })
        assert.deepEqual(await sent.json(), { sent: true })
        assert.equal(
          (await post("/complete", { code, verifier, emailCode: "wrong" }))
            .status,
          400,
        )
        const finished = await post("/complete", {
          code,
          verifier,
          emailCode,
          fullName: "Social Person",
          contactNumber: "+63 912 345 6789",
        })
        assert.equal(finished.status, 200)
        const session = (await finished.json()) as {
          token: string
          user: { role: string }
        }
        assert.match(session.token, /^[A-Za-z0-9_-]{43}$/)
        assert.equal(session.user.role, "USER")
        assert.equal(
          (
            await prisma.user.findUniqueOrThrow({
              where: { email: "new@example.test" },
            })
          ).passwordHash,
          null,
        )
        const me = await fetch(`${base}/api/auth/me`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        assert.equal(me.status, 200)
        const logout = await fetch(`${base}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.token}` },
        })
        assert.equal(logout.status, 204)
        assert.equal(
          (
            await fetch(`${base}/api/auth/me`, {
              headers: { Authorization: `Bearer ${session.token}` },
            })
          ).status,
          401,
        )
        assert.equal((await post("/complete", { code, verifier })).status, 400)
        assert.equal(await prisma.user.count(), 1)
      },
    )
    await reset()
    await t.test(
      "returning provider subject preserves the existing ADMIN and email",
      async () => {
        const user = await prisma.user.create({
          data: {
            email: "admin@example.test",
            role: "ADMIN",
            passwordHash: null,
          },
        })
        await prisma.socialIdentity.create({
          data: { provider: "facebook", subject, userId: user.id },
        })
        const code = (await callback(await begin())).get("code")!
        const response = await post("/complete", { code, verifier })
        const result = (await response.json()) as {
          user: { id: string; role: string; email: string }
        }
        assert.equal(result.user.id, user.id)
        assert.equal(result.user.role, "ADMIN")
        assert.equal(result.user.email, "admin@example.test")
        assert.equal(await prisma.user.count(), 1)
      },
    )
    await reset()
    await t.test(
      "matching verified email never auto-links an existing password account",
      async () => {
        await prisma.user.create({
          data: {
            email: "existing@example.test",
            passwordHash: await hashPassword("existing long password"),
          },
        })
        const code = (await callback(await begin())).get("code")!
        await post("/email", { code, verifier, email: "existing@example.test" })
        const response = await post("/complete", {
          code,
          verifier,
          emailCode,
          fullName: "Social Person",
          contactNumber: "09123456789",
        })
        assert.equal(response.status, 409)
        assert.equal(await prisma.user.count(), 1)
        assert.equal(await prisma.socialIdentity.count(), 0)
        assert.equal(await prisma.session.count(), 0)
      },
    )
    await reset()
    await t.test(
      "cancelled, expired, replayed and failed callbacks create no accounts or sessions",
      async () => {
        const state = await begin()
        assert.equal(
          (await callback(state, "access_denied")).get("error"),
          "cancelled",
        )
        assert.equal((await callback(state)).get("error"), "failed")
        const expired = await begin()
        await prisma.oAuthAttempt.update({
          where: { id: digest(expired) },
          data: { expiresAt: new Date(0) },
        })
        assert.equal((await callback(expired)).get("error"), "failed")
        providerFailure = true
        assert.equal((await callback(await begin())).get("error"), "failed")
        assert.equal(await prisma.socialCompletion.count(), 0)
        assert.equal(await prisma.user.count(), 0)
        assert.equal(await prisma.session.count(), 0)
      },
    )
    await reset()
    await t.test(
      "linking needs password proof and the initiating live EXP session",
      async () => {
        const user = await prisma.user.create({
          data: {
            email: "owner@example.test",
            passwordHash: await hashPassword("existing long password"),
          },
        })
        const session = await issueSession(user)
        const rejected = await post(
          "/facebook/start",
          {
            purpose: "link",
            verifierHash: digest(verifier),
            currentPassword: "wrong",
          },
          session.token,
        )
        assert.equal(rejected.status, 401)
        const code = (
          await callback(
            await begin("link", session.token, "existing long password"),
          )
        ).get("code")!
        assert.equal((await post("/complete", { code, verifier })).status, 401)
        const accepted = await post(
          "/complete",
          { code, verifier },
          session.token,
        )
        assert.deepEqual(await accepted.json(), { linked: true })
        const identity = await prisma.socialIdentity.findUniqueOrThrow({
          where: { provider_subject: { provider: "facebook", subject } },
        })
        assert.equal(identity.userId, user.id)
        assert.equal(await prisma.session.count(), 1)
        assert.equal(await prisma.user.count(), 1)
      },
    )
    await reset()
    await t.test(
      "social-only reauthentication must use an identity already owned by this session",
      async () => {
        const user = await prisma.user.create({
          data: { email: "social@example.test", passwordHash: null },
        })
        const session = await issueSession(user)
        await prisma.socialIdentity.create({
          data: { provider: "facebook", subject, userId: user.id },
        })
        subject = "someone-else"
        const deniedCode = (
          await callback(await begin("reauth", session.token))
        ).get("code")!
        assert.equal(
          (
            await post(
              "/complete",
              { code: deniedCode, verifier },
              session.token,
            )
          ).status,
          403,
        )
        subject = "facebook-subject"
        const code = (await callback(await begin("reauth", session.token))).get(
          "code",
        )!
        assert.deepEqual(
          await (
            await post("/complete", { code, verifier }, session.token)
          ).json(),
          { reauthenticated: true },
        )
        assert.ok(
          (
            await prisma.session.findUniqueOrThrow({
              where: { tokenHash: digest(session.token) },
            })
          ).reauthenticatedAt,
        )
        assert.ok(await begin("link", session.token))
      },
    )
    await reset()
    await t.test(
      "five failed email guesses exhaust the challenge, including a later correct code",
      async () => {
        const code = (await callback(await begin())).get("code")!
        await post("/email", { code, verifier, email: "new@example.test" })
        assert.equal(
          (
            await post("/email", {
              code,
              verifier,
              email: "different@example.test",
            })
          ).status,
          429,
        )
        for (let i = 0; i < 5; i++)
          assert.equal(
            (await post("/complete", { code, verifier, emailCode: "00000000" }))
              .status,
            400,
          )
        assert.equal(
          (
            await post("/complete", {
              code,
              verifier,
              emailCode,
              fullName: "Social Person",
              contactNumber: "09123456789",
            })
          ).status,
          400,
        )
        assert.equal(await prisma.user.count(), 0)
        assert.equal(await prisma.session.count(), 0)
      },
    )
    await reset()
    await t.test(
      "ordinary sign-ins sharing an IP are not capped at ten requests",
      async () => {
        for (let i = 0; i < 11; i++) assert.ok(await begin())
        assert.equal(await prisma.user.count(), 0)
        assert.equal(await prisma.session.count(), 0)
      },
    )
    await reset()
    await t.test(
      "concurrent exchanges of a known provider identity yield only one EXP session",
      async () => {
        const user = await prisma.user.create({
          data: { email: "existing@example.test", passwordHash: null },
        })
        await prisma.socialIdentity.create({
          data: { provider: "facebook", subject, userId: user.id },
        })
        const code = (await callback(await begin())).get("code")!
        const responses = await Promise.all([
          post("/complete", { code, verifier }),
          post("/complete", { code, verifier }),
        ])
        assert.equal(
          responses.filter((response) => response.status === 200).length,
          1,
        )
        assert.equal(await prisma.session.count(), 1)
      },
    )
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    await prisma.$disconnect()
    await socket.stop()
    await db.close()
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
})
