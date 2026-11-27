import assert from "node:assert/strict"
import { test } from "node:test"
import type { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { hashPassword } from "../../../src/features/auth/auth.password.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test(
  "PG-023-F004-A001-T004 validates employee directory query parameters",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const admin = await prisma.user.create({
      data: {
        email: "pg023-query@example.test",
        fullName: "Directory Test Admin",
        passwordHash: await hashPassword("DirectoryTest123!"),
        role: "ADMIN",
        isActive: true,
      },
    })
    const { token } = await issueSession(admin)
    const list = (query = "") =>
      fetch(`${base}/employees${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      workforceChanges: await prisma.workforceManagementChange.count(),
    })
    const before = await snapshot()

    for (const query of [
      "?search=a&search=b",
      "?archived=yes",
      "?employmentType=invalid",
      "?status=invalid",
      `?search=${"a".repeat(101)}`,
      `?departmentId=${"a".repeat(81)}`,
      "?page=0",
      "?page=abc",
      "?page=100001",
    ]) {
      const response = await list(query)
      assert.equal(response.status, 400, query)
      assert.deepEqual(await response.json(), {
        error: "Invalid employee filters",
      })
    }

    const defaultResponse = await list()
    const emptyFilters = await list(
      "?search=&departmentId=&employmentType=&status=&archived=",
    )
    assert.equal(defaultResponse.status, 200)
    assert.equal(emptyFilters.status, 200)
    const defaultBody = await defaultResponse.json()
    assert.ok(defaultBody && typeof defaultBody === "object")
    assert.ok("page" in defaultBody && "pageSize" in defaultBody)
    assert.equal(defaultBody.page, 1)
    assert.equal(defaultBody.pageSize, 10)
    assert.deepEqual(await emptyFilters.json(), defaultBody)
    assert.deepEqual(await snapshot(), before)
  },
)

test(
  "PG-023-F002-A002-T037 reads the employee detail projection by directory identity",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const passwordHash = await hashPassword("DirectoryTest123!")
    const account = (id: string, role: Role, archived = false) =>
      prisma.user.create({
        data: {
          id,
          email: `${id}@example.test`,
          fullName: id,
          passwordHash,
          role,
          isActive: !archived,
          accountDeletedAt: archived ? new Date("2026-01-01") : null,
        },
      })
    const admin = await account("detail-admin", "ADMIN")
    const root = await account("detail-root", "SUPERADMIN")
    const linked = await account("detail-linked", "STAFF")
    const standalone = await account("detail-standalone", "STAFF")
    const archived = await account("detail-archived", "STAFF", true)
    const client = await account("detail-client", "USER")
    const employee = await prisma.employee.create({
      data: {
        employeeId: "EXP-DETAIL",
        fullName: linked.fullName ?? linked.email,
        userId: linked.id,
        position: "Test Engineer",
      },
    })
    const [adminSession, rootSession, staffSession, clientSession] =
      await Promise.all(
        [admin, root, linked, client].map((user) => issueSession(user)),
      )
    const detail = (id: string, token: string) =>
      fetch(`${base}/employees/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    const snapshot = async () => ({
      users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
      employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
      history: await prisma.workforceManagementChange.count(),
    })
    const before = await snapshot()
    for (const { token } of [adminSession, rootSession]) {
      const byProfile = await detail(employee.id, token)
      const byAccount = await detail(`account:${linked.id}`, token)
      assert.equal(byProfile.status, 200)
      assert.equal(byAccount.status, 200)
      const body = await byProfile.json()
      assert.partialDeepStrictEqual(body, {
        employee: {
          id: employee.id,
          accountId: linked.id,
          employeeId: "EXP-DETAIL",
          hasEmployeeRecord: true,
          email: linked.email,
          position: "Test Engineer",
        },
      })
      assert.deepEqual(await byAccount.json(), body)
      assert.doesNotMatch(JSON.stringify(body), /passwordHash|DirectoryTest123/)

      const recordless = await detail(`account:${standalone.id}`, token)
      assert.equal(recordless.status, 200)
      assert.partialDeepStrictEqual(await recordless.json(), {
        employee: {
          id: `account:${standalone.id}`,
          accountId: standalone.id,
          hasEmployeeRecord: false,
          employeeId: "",
          position: null,
          status: null,
        },
      })
      for (const id of ["missing-detail-id", `account:${archived.id}`]) {
        const response = await detail(id, token)
        assert.equal(response.status, 404)
        assert.deepEqual(await response.json(), { error: "Employee not found" })
      }
    }
    for (const { token } of [staffSession, clientSession]) {
      const response = await detail(employee.id, token)
      assert.equal(response.status, 403)
      assert.doesNotMatch(await response.text(), /EXP-DETAIL|Test Engineer/)
    }
    assert.deepEqual(await snapshot(), before)
  },
)
