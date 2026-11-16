/** Native child process: exercises demo ownership without forging node:test
 * context or using an application test activation callback. No HTTP controls. */
import assert from "node:assert/strict"
import { once } from "node:events"
import {
  createLocalDemoDatabase,
  verifyLocalDemo,
} from "../../src/features/system-logs/local-demo.js"
import { startApi } from "../../src/server.js"
import { issueSession } from "../../src/features/auth/auth.service.js"
import { createApp } from "../../src/app.js"
import { listen, closeServer } from "./pglite-app.js"

assert.equal(process.env.NODE_TEST_CONTEXT, undefined)
process.env.NODE_ENV = "production"
await assert.rejects(createLocalDemoDatabase(), /credential-isolated/)
process.env.NODE_ENV = "development"
const demo = await createLocalDemoDatabase()
const api = startApi({ systemLogsLocalDemo: demo.access })
try {
  await once(api.server, "listening")
  const address = api.server.address()
  assert.ok(address && typeof address !== "string")
  assert.equal(address.address, "127.0.0.1")
  const origin = `http://127.0.0.1:${address.port}`
  assert.equal(verifyLocalDemo(demo.access), true)
  assert.equal(verifyLocalDemo({ ...demo.access }), false)
  const paths = ["management-history", "errors", "health"]
  const root = await demo.prisma.user.create({
    data: {
      email: "probe@demo.invalid",
      passwordHash: "not-a-login-credential",
      role: "SUPERADMIN",
    },
  })
  let token = (await issueSession(root)).token
  async function statuses(expected: number, authorization = token) {
    for (const path of paths) {
      const response = await fetch(`${origin}/api/system-logs/${path}`, {
        headers: { Authorization: `Bearer ${authorization}` },
      })
      assert.equal(response.status, expected, path)
      assert.equal(response.headers.get("cache-control"), "no-store")
      await response.body?.cancel()
    }
  }
  await statuses(200)
  for (const role of ["ADMIN", "STAFF", "USER"] as const) {
    const user = await demo.prisma.user.create({
      data: {
        email: `${role}@demo.invalid`,
        passwordHash: "not-a-login-credential",
        role,
      },
    })
    await statuses(403, (await issueSession(user)).token)
  }
  await demo.prisma.user.update({
    where: { id: root.id },
    data: { isActive: false },
  })
  await statuses(401)
  await demo.prisma.user.update({
    where: { id: root.id },
    data: { isActive: true, role: "ADMIN" },
  })
  await statuses(403)
  await demo.prisma.user.update({
    where: { id: root.id },
    data: { role: "SUPERADMIN" },
  })
  await demo.prisma.session.deleteMany({ where: { userId: root.id } })
  await statuses(401)
  token = (await issueSession(root)).token
  process.env.NODE_ENV = "production"
  await statuses(404)
  process.env.NODE_ENV = "development"
  const databaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = "postgresql://untrusted.invalid/never-connect"
  await statuses(404)
  process.env.DATABASE_URL = databaseUrl
  process.env.DIRECT_URL = databaseUrl
  await statuses(404)
  delete process.env.DIRECT_URL
  await statuses(200)
  const normal = await listen(createApp())
  try {
    assert.equal(
      (await fetch(`${normal.origin}/api/system-logs/health`)).status,
      404,
    )
  } finally {
    await closeServer(normal.server)
  }
  await demo.close()
  assert.equal(verifyLocalDemo(demo.access), false)
  await statuses(404)
  process.send!({ type: "complete", nativeDemo: true })
} finally {
  await api.shutdown("SIGTERM")
  await demo.close()
  if (process.connected) process.disconnect()
}
