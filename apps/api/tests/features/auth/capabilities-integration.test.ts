import assert from "node:assert/strict"
import { test } from "node:test"
import express from "express"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  AdministrativeCapability,
  hasAdministrativeCapability,
} from "../../../src/features/auth/auth.capabilities.js"
import {
  requireAuth,
  requirePermission,
  requireRole,
} from "../../../src/features/auth/auth.middleware.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { Permission } from "../../../src/features/auth/auth.permissions.js"
import { activeStaff } from "../../../src/shared/query/accounts.js"
import {
  closeServer,
  listen,
  startPgliteDatabase,
} from "../../support/pglite-app.js"

test(
  "administrative grants use the current authenticated account without bypassing role gates",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, beforeShutdown } = await startPgliteDatabase(t)
    const user = await prisma.user.create({
      data: {
        email: "foundation-superadmin@example.test",
        role: Role.SUPERADMIN,
        passwordHash: "test-only",
      },
    })
    const session = await issueSession(user)
    assert.equal(await prisma.employee.count({ where: { userId: user.id } }), 0)
    assert.equal(
      await prisma.department.count({ where: { headId: user.id } }),
      0,
    )
    assert.equal(
      await prisma.user.count({ where: { id: user.id, ...activeStaff } }),
      0,
    )
    for (const permission of Object.values(AdministrativeCapability))
      assert.ok(session.user.permissions.includes(permission))

    // Test-only routes exercise the foundation; production modules are unchanged.
    const app = express()
    app.get(
      "/administrative",
      requireAuth,
      requirePermission(Permission.ORGANIZATION_READ_ALL),
      (request, response) => {
        response.json({
          allowed: hasAdministrativeCapability(
            request.auth!.user,
            AdministrativeCapability.ORGANIZATION_READ,
          ),
        })
      },
    )
    app.get(
      "/client",
      requireAuth,
      requireRole(Role.USER),
      (_request, response) => {
        response.json({ allowed: true })
      },
    )
    const { server, origin } = await listen(app)
    beforeShutdown(() => closeServer(server))
    const request = (path: string) =>
      fetch(`${origin}${path}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
    assert.equal((await fetch(`${origin}/administrative`)).status, 401)
    const allowed = await request("/administrative")
    assert.equal(allowed.status, 200)
    assert.deepEqual(await allowed.json(), { allowed: true })
    assert.equal((await request("/client")).status, 403)

    for (const role of [Role.ADMIN, Role.STAFF, Role.USER]) {
      await prisma.user.update({ where: { id: user.id }, data: { role } })
      assert.equal((await request("/administrative")).status, 403, role)
      assert.equal(
        (await request("/client")).status,
        role === Role.USER ? 200 : 403,
      )
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.SUPERADMIN, isActive: false },
    })
    assert.equal((await request("/administrative")).status, 401)
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, accountDeletedAt: new Date() },
    })
    assert.equal((await request("/administrative")).status, 401)
  },
)
