import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type UserListResponse = {
  users: Array<{
    id: string
    email: string
    fullName: string | null
    role: Role
    passwordHash?: string
  }>
  total: number
  page: number
  pageSize: number
}

test(
  "[PG-002-F001-A001-T001] users list filters, sorts, paginates and redacts credentials",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const base = origin + "/api"
    const actor = await prisma.user.create({
      data: {
        id: "pg002-list-root",
        email: "pg002-list-root@example.test",
        fullName: "PG002 List Root",
        passwordHash: "test-only-private-hash",
        role: Role.SUPERADMIN,
      },
    })
    const admin = await prisma.user.create({
      data: {
        id: "pg002-list-admin",
        email: "pg002-list-admin@example.test",
        fullName: "PG002 List Admin",
        passwordHash: "test-only-private-hash",
        role: Role.ADMIN,
      },
    })
    const actorToken = (await issueSession(actor)).token
    const adminToken = (await issueSession(admin)).token

    for (let index = 1; index <= 12; index += 1) {
      const suffix = String(index).padStart(2, "0")
      await prisma.user.create({
        data: {
          id: "pg002-needle-" + suffix,
          email: "needle-member-" + suffix + "@example.test",
          fullName: "Needle Member " + suffix,
          passwordHash: "test-only-private-hash",
          role: Role.USER,
          isActive: index % 2 === 0,
          createdAt: new Date("2026-01-" + suffix + "T00:00:00.000Z"),
        },
      })
    }
    await prisma.user.create({
      data: {
        id: "pg002-needle-staff",
        email: "needle-staff@example.test",
        fullName: "Needle Staff",
        passwordHash: "test-only-private-hash",
        role: Role.STAFF,
      },
    })
    await prisma.user.create({
      data: {
        id: "pg002-needle-trash",
        email: "needle-trash@example.test",
        fullName: "Needle Trashed",
        passwordHash: "test-only-private-hash",
        role: Role.USER,
        isActive: false,
        accountDeletedAt: new Date("2026-10-15T00:00:00.000Z"),
      },
    })

    const list = (query = "", token: string | null = actorToken) =>
      fetch(base + "/users" + query, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      })
    assert.equal((await list("", null)).status, 401)
    assert.equal((await list("", adminToken)).status, 403)

    const firstPageResponse = await list(
      "?search=needle&role=USER&sort=member&direction=asc&page=1",
    )
    assert.equal(firstPageResponse.status, 200)
    const firstPage = (await firstPageResponse.json()) as UserListResponse
    assert.equal(firstPage.total, 12)
    assert.equal(firstPage.page, 1)
    assert.equal(firstPage.pageSize, 10)
    assert.deepEqual(
      firstPage.users.map((user) => user.fullName),
      Array.from(
        { length: 10 },
        (_, index) => "Needle Member " + String(index + 1).padStart(2, "0"),
      ),
    )
    assert.ok(firstPage.users.every((user) => user.role === Role.USER))
    assert.ok(firstPage.users.every((user) => !("passwordHash" in user)))

    const secondPageResponse = await list(
      "?search=needle&role=USER&sort=member&direction=asc&page=2",
    )
    assert.equal(secondPageResponse.status, 200)
    const secondPage = (await secondPageResponse.json()) as UserListResponse
    assert.equal(secondPage.total, 12)
    assert.equal(secondPage.page, 2)
    assert.deepEqual(
      secondPage.users.map((user) => user.fullName),
      ["Needle Member 11", "Needle Member 12"],
    )

    const trashResponse = await list(
      "?search=needle&role=USER&sort=deletedAt&direction=desc&deleted=true",
    )
    assert.equal(trashResponse.status, 200)
    const trash = (await trashResponse.json()) as UserListResponse
    assert.equal(trash.total, 1)
    assert.deepEqual(
      trash.users.map((user) => user.id),
      ["pg002-needle-trash"],
    )
    assert.ok(!("passwordHash" in (trash.users[0] ?? {})))

    for (const query of [
      "?search=" + "x".repeat(101),
      "?role=VISITOR",
      "?sort=passwordHash",
      "?direction=sideways",
      "?page=1x",
    ]) {
      const response = await list(query)
      assert.equal(response.status, 400, query)
      assert.deepEqual(await response.json(), {
        error: "Invalid account filters",
      })
    }
  },
)
