import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "PG-024-F007-A001-T007 counts each overview directory population",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const createUser = (
      name: string,
      role: "ADMIN" | "SUPERADMIN" | "STAFF" | "USER",
      isActive = true,
      archived = false,
    ) =>
      prisma.user.create({
        data: {
          fullName: name,
          email: name + "@pg024.example.test",
          passwordHash: "synthetic-unused",
          role,
          isActive,
          accountDeletedAt: archived ? new Date("2026-01-01") : null,
        },
      })
    const admin = await createUser("admin", "ADMIN")
    const superadmin = await createUser("superadmin", "SUPERADMIN")
    const user = await createUser("user", "USER")
    const rows = [
      [await createUser("active", "STAFF"), "ACTIVE", "FULL_TIME"],
      [await createUser("leave", "STAFF", false), "ON_LEAVE", "PART_TIME"],
      [await createUser("inactive", "STAFF"), "INACTIVE", "CONTRACT"],
      [await createUser("intern", "STAFF"), "ACTIVE", "INTERN"],
      [
        await createUser("archived", "STAFF", false, true),
        "ACTIVE",
        "FULL_TIME",
      ],
      [user, "ACTIVE", "FULL_TIME"],
      [superadmin, "ACTIVE", "FULL_TIME"],
      [null, "ACTIVE", "FULL_TIME"],
    ] as const
    for (const [index, [account, status, employmentType]] of rows.entries()) {
      await prisma.employee.create({
        data: {
          employeeId: "PG024-" + index,
          fullName: "Synthetic " + index,
          userId: account?.id,
          status,
          employmentType,
        },
      })
    }
    const tokens = await Promise.all([
      issueSession(admin),
      issueSession(superadmin),
    ])
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      history: await prisma.workforceManagementChange.findMany(),
    })
    const before = await snapshot()
    for (const { token } of tokens) {
      for (const [filter, total] of [
        ["", 5],
        ["&status=ACTIVE", 2],
        ["&status=ON_LEAVE", 1],
        ["&status=INACTIVE", 1],
        ["&archived=true", 1],
        ["&employmentType=FULL_TIME", 1],
        ["&employmentType=PART_TIME", 1],
        ["&employmentType=CONTRACT", 1],
        ["&employmentType=INTERN", 1],
      ] as const) {
        const response = await fetch(base + "/employees?page=1" + filter, {
          headers: { Authorization: "Bearer " + token },
        })
        assert.equal(response.status, 200, filter)
        const body = await response.json()
        assert.ok(body && typeof body === "object" && "total" in body)
        assert.equal(body.total, total, filter)
      }
    }
    assert.deepEqual(await snapshot(), before)
  },
)

test(
  "PG-024-F002-A001-T002 enforces direct Employee list admission without domain writes",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const sessions = []
    for (const role of ["ADMIN", "SUPERADMIN", "STAFF", "USER"] as const) {
      const user = await prisma.user.create({
        data: {
          role,
          email: role.toLowerCase() + "@pg024-guard.example.test",
          fullName: "Synthetic " + role,
          passwordHash: "synthetic-unused",
          isActive: true,
        },
      })
      sessions.push({ role, ...(await issueSession(user)) })
    }
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      history: await prisma.workforceManagementChange.findMany(),
    })
    const before = await snapshot()
    for (const { role, token } of sessions) {
      const response = await fetch(base + "/employees?page=1", {
        headers: { Authorization: "Bearer " + token },
      })
      const body = await response.json()
      const allowed = role === "ADMIN" || role === "SUPERADMIN"
      assert.equal(response.status, allowed ? 200 : 403, role)
      assert.ok(body && typeof body === "object")
      if (allowed)
        assert.ok("employees" in body && Array.isArray(body.employees))
      else assert.ok(!("employees" in body), role)
    }
    const anonymous = await fetch(base + "/employees?page=1")
    assert.equal(anonymous.status, 401)
    await anonymous.json()
    assert.deepEqual(await snapshot(), before)
  },
)
