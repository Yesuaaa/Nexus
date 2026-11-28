import assert from "node:assert/strict"
import { test } from "node:test"
import { startPgliteApp } from "./support/pglite-app.js"

const login = (base: string, email: string, password: string) =>
  fetch(base + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

test(
  "PG-026-F014-A001-T014 local limiter denials add no sessions",
  { timeout: 120_000 },
  async (t) => {
    const { base, prisma } = await startPgliteApp(t)
    const baseline = await prisma.session.count()
    const refreshBaseline = await prisma.refreshToken.count()
    const credentialStatuses = []
    for (let i = 0; i < 11; i++) {
      const response = await login(
        base,
        "limited@pg026.test",
        "Synthetic rejected password",
      )
      credentialStatuses.push(response.status)
      await response.text()
    }
    const sourceStatuses = []
    let retryAfter: string | null = null
    for (let i = 0; i < 50; i++) {
      const response = await login(base, "", "")
      sourceStatuses.push(response.status)
      retryAfter = response.headers.get("Retry-After")
      await response.text()
    }
    const after = await prisma.session.count()
    const afterRefresh = await prisma.refreshToken.count()
    assert.deepEqual(credentialStatuses, [...Array<number>(10).fill(401), 429])
    assert.deepEqual(sourceStatuses, [...Array<number>(49).fill(400), 429])
    assert.ok(retryAfter && Number(retryAfter) > 0 && Number(retryAfter) <= 60)
    assert.equal(after, baseline)
    assert.equal(afterRefresh, refreshBaseline)
  },
)
