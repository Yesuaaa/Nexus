import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import {
  moduleRegistry,
  getAdministrativeModule,
} from "../../../src/features/modules/modules.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "module registration permits global entry without operational membership",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const account = await prisma.user.create({
      data: {
        email: "module-access@example.test",
        passwordHash: "test-only",
        role: Role.SUPERADMIN,
      },
    })
    const { token } = await issueSession(account)
    const request = (path: string) =>
      fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal((await fetch(`${base}/modules`)).status, 401)
    assert.equal(
      await prisma.employee.count({ where: { userId: account.id } }),
      0,
    )
    const response = await request("/modules")
    assert.equal(response.status, 200)
    const { modules } = (await response.json()) as {
      modules: { id: string; href: string }[]
    }
    assert.deepEqual(
      modules.map((module) => module.id),
      Object.keys(moduleRegistry).filter(
        (id) => moduleRegistry[id as keyof typeof moduleRegistry].implemented,
      ),
    )
    for (const module of modules)
      assert.equal((await request(`/modules/${module.id}`)).status, 200)
    assert.equal(
      modules.find((module) => module.id === "project-management")?.href,
      "/module/project-management",
    )
    assert.equal(
      modules.find((module) => module.id === "attendance-monitoring")?.href,
      "/attendance/dashboard",
    )
    for (const id of [
      "unknown",
      "billing-finance",
      "constructor",
      "toString",
      "__proto__",
    ])
      assert.equal((await request(`/modules/${id}`)).status, 404, id)
    const futureRegistry = {
      ...moduleRegistry,
      future: {
        ...moduleRegistry["project-management"],
        title: "Future Module",
      },
    }
    assert.equal(
      getAdministrativeModule(account, "future", futureRegistry).href,
      "/module/future",
    )
    for (const path of [
      "/project-workspace",
      "/request-inbox",
      "/workload?week=2026-11-16",
      "/attendance/me/current",
      "/client/services",
    ])
      assert.equal((await request(path)).status, 403, path)
    for (const role of [Role.ADMIN, Role.STAFF, Role.USER]) {
      await prisma.user.update({ where: { id: account.id }, data: { role } })
      assert.equal((await request("/modules")).status, 403)
      assert.equal((await request("/modules/project-management")).status, 403)
    }
    await prisma.user.update({
      where: { id: account.id },
      data: { role: Role.SUPERADMIN, isActive: false },
    })
    assert.equal((await request("/modules/project-management")).status, 401)
  },
)
