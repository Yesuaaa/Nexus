import assert from "node:assert/strict"
import { test } from "node:test"
import { verifyAccessToken } from "../../../src/features/auth/auth.jwt.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "PG-021-F001-A011-T001 expired and revoked sessions cannot read or write departments",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "pg021-admin@example.test",
        role: "ADMIN",
        passwordHash: "fixture",
      },
    })
    const department = await prisma.department.create({
      data: { name: "QA department" },
    })
    const snapshot = async () => ({
      departments: await prisma.department.findMany(),
      employees: await prisma.employee.findMany(),
      users: await prisma.user.findMany(),
      history: await prisma.workforceManagementChange.findMany(),
    })
    const before = await snapshot()
    for (const state of ["expired", "revoked"] as const) {
      const { token } = await issueSession(admin)
      const { sessionId } = await verifyAccessToken(token)
      const where = { id: sessionId }
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
      const baseline = await fetch(`${base}/departments`, { headers })
      assert.equal(baseline.status, 200)
      await baseline.json()
      if (state === "expired") {
        await prisma.session.update({ where, data: { expiresAt: new Date(0) } })
      } else {
        await prisma.session.delete({ where })
      }
      for (const [path, method] of [
        ["/departments", "GET"],
        [`/departments/${department.id}`, "GET"],
        [`/departments/${department.id}`, "PUT"],
      ]) {
        const response = await fetch(`${base}${path}`, {
          method,
          headers,
          body:
            method === "PUT"
              ? JSON.stringify({ name: "Denied name" })
              : undefined,
        })
        assert.equal(response.status, 401, `${state} ${method} ${path}`)
        assert.deepEqual(await response.json(), {
          error: "Invalid or expired session",
        })
      }
      assert.deepEqual(await snapshot(), before)
    }
  },
)

test(
  "PG-021-F001-A016-T001 employee options are bounded and observational",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "pg021-options-admin@example.test",
        role: "ADMIN",
        passwordHash: "fixture",
      },
    })
    const staff = await prisma.user.create({
      data: {
        email: "pg021-staff@example.test",
        fullName: "QA candidate",
        role: "STAFF",
        passwordHash: "fixture",
      },
    })
    const { token } = await issueSession(admin)
    const snapshot = async () => ({
      departments: await prisma.department.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      history: await prisma.workforceManagementChange.findMany({
        orderBy: { id: "asc" },
      }),
    })
    const before = await snapshot()
    const get = (query = "") =>
      fetch(`${base}/departments/employee-options${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    const expected = {
      employees: [
        {
          id: staff.id,
          fullName: staff.fullName,
          email: staff.email,
          contactNumber: staff.contactNumber,
          position: staff.position,
          departmentId: null,
          user: {
            id: staff.id,
            email: staff.email,
            fullName: staff.fullName,
            role: "STAFF",
            isActive: true,
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    }
    for (const query of ["", "?search=%20QA%20candidate%20&page=1"]) {
      const response = await get(query)
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), expected)
    }
    const atLimit = await get(`?search=%20${"x".repeat(100)}%20`)
    assert.equal(atLimit.status, 200)
    assert.deepEqual(await atLimit.json(), {
      employees: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
    for (const query of [
      `?search=${"x".repeat(101)}`,
      "?search=a&search=b",
      "?page=0",
      "?page=100001",
    ]) {
      const response = await get(query)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), {
        error: "Invalid employee filters",
      })
    }
    assert.deepEqual(await snapshot(), before)
  },
)
