import assert from "node:assert/strict"
import { test } from "node:test"
import { hashPassword } from "../src/features/auth/auth.password.js"
import { issueSession, tokenHash } from "../src/features/auth/auth.service.js"
import { startPgliteApp } from "./support/pglite-app.js"

const credentials = "  Synthetic client fixture 123!  "

const login = (base: string, email: string, password: string) =>
  fetch(base + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

test(
  "PG-027-F013-A001-T013 account denial and persisted attribution",
  { timeout: 120_000 },
  async (t) => {
    const { base, prisma } = await startPgliteApp(t)
    const passwordHash = await hashPassword(credentials)
    for (const [state, isActive, accountDeletedAt] of [
      ["active", true, null],
      ["inactive", false, null],
      ["archive", false, new Date("2026-01-01")],
    ] as const) {
      await prisma.user.create({
        data: {
          email: state + "@pg027.test",
          role: "USER",
          isActive,
          accountDeletedAt,
          passwordHash,
        },
      })
    }
    const unrelated = await prisma.user.create({
      data: { email: "unrelated@pg027.test", role: "USER", passwordHash },
    })
    await issueSession(unrelated)
    const unrelatedFamily = () =>
      prisma.session.findMany({
        where: { userId: unrelated.id },
        include: { refreshTokens: true },
      })
    const unrelatedBefore = await unrelatedFamily()
    const users = () => prisma.user.findMany({ orderBy: { id: "asc" } })
    const before = await users()
    const baseline = await prisma.session.count()
    const refreshBaseline = await prisma.refreshToken.count()
    const denials = []
    for (const name of ["inactive", "archive", "unknown", "active"]) {
      const response = await login(
        base,
        name + "@pg027.test",
        name === "active" ? "Wrong synthetic password" : credentials,
      )
      denials.push({ status: response.status, body: await response.json() })
    }
    const afterDenied = await prisma.session.count()
    const afterDeniedRefresh = await prisma.refreshToken.count()
    const afterDeniedUsers = await users()
    const response = await login(base, "  ACTIVE@PG027.TEST  ", credentials)
    const result = (await response.json()) as {
      user?: { id: string }
      refreshToken?: string
      token?: string
    }
    const rows = await prisma.session.findMany({
      include: { refreshTokens: true },
    })
    const afterValid = await users()
    const unrelatedAfter = await unrelatedFamily()
    for (const denial of denials)
      assert.deepEqual(denial, {
        status: 401,
        body: { error: "Invalid email or password" },
      })
    assert.equal(afterDenied, baseline)
    assert.equal(afterDeniedRefresh, refreshBaseline)
    assert.ok(
      JSON.stringify(afterDeniedUsers) === JSON.stringify(before),
      "denials must preserve protected User records",
    )
    assert.ok(
      JSON.stringify(afterValid) === JSON.stringify(before),
      "login must preserve protected User records",
    )
    assert.ok(
      JSON.stringify(unrelatedAfter) === JSON.stringify(unrelatedBefore),
      "Existing family must be unchanged",
    )
    assert.equal(response.status, 200)
    assert.equal(rows.length, baseline + 1)
    const owner = before.find((user) => user.email === "active@pg027.test")
    assert.ok(owner && result.user && result.refreshToken && result.token)
    assert.equal(result.user.id, owner.id)
    const session = rows.find((item) => item.userId === owner.id)
    assert.ok(session)
    assert.equal(session.refreshTokens.length, 1)
    assert.ok(session.tokenHash === tokenHash(result.refreshToken))
    assert.ok(session.refreshTokens[0].tokenHash === session.tokenHash)
    assert.equal("passwordHash" in result.user, false)
    assert.equal("password" in result.user, false)
  },
)
