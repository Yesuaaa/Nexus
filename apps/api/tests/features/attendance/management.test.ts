import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"
import { createManagementContext } from "./management/context.js"
import { accessAndPolicies } from "./management/access-and-policies.js"
import { requestsAndReviews } from "./management/requests-and-reviews.js"
import { auditAndMonitoring } from "./management/audit-and-monitoring.js"
import { overviews } from "./management/overviews.js"
import { personalOverview } from "./management/personal-overview.js"

test(
  "attendance management policies, department scope, and correction approvals",
  { timeout: 120000 },
  async (t) => {
    const context = await createManagementContext(t)
    await accessAndPolicies(t, context)
    await requestsAndReviews(t, context)
    await auditAndMonitoring(t, context)
    await overviews(t, context)
    await personalOverview(t, context)
  },
)

test(
  "[PG-005-F001-A003-T015] audit endpoint denies anonymous and USER callers",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const user = await prisma.user.create({
      data: {
        email: "pg005-audit-user@test.local",
        fullName: "PG005 audit user",
        role: "USER",
        passwordHash: "test-only",
      },
    })
    const token = (await issueSession(user)).token
    const anonymous = await fetch(base + "/attendance/audit")
    assert.equal(anonymous.status, 401)
    const forbidden = await fetch(base + "/attendance/audit", {
      headers: { Authorization: "Bearer " + token },
    })
    assert.equal(forbidden.status, 403)
    for (const response of [anonymous, forbidden]) {
      const body = (await response.json()) as Record<string, unknown>
      assert.equal("events" in body, false)
    }
  },
)

test(
  "[PG-005-F001-A010-T016] audit endpoint validates query values and boundaries",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const headUser = await prisma.user.create({
      data: {
        email: "pg005-audit-head@test.local",
        fullName: "PG005 audit head",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    await prisma.department.create({
      data: { name: "PG005 audit department", headId: headUser.id },
    })
    const adminUser = await prisma.user.create({
      data: {
        email: "pg005-audit-admin@test.local",
        fullName: "PG005 audit admin",
        role: "ADMIN",
        passwordHash: "test-only",
      },
    })
    const headToken = (await issueSession(headUser)).token
    const adminToken = (await issueSession(adminUser)).token
    const request = (token: string, path: string) =>
      fetch(base + "/attendance" + path, {
        headers: { Authorization: "Bearer " + token },
      })
    const range = "from=2026-11-13&to=2026-11-13"
    const invalidQueries: [string, string][] = [
      ["search-over-100", range + "&search=" + "x".repeat(101)],
      ["repeated-search", range + "&search=one&search=two"],
      ["impossible-date", "from=2026-02-30&to=2026-03-01"],
      ["wrong-date-format", "from=2026/11/13&to=2026-11-13"],
      ["reversed-range", "from=2026-11-14&to=2026-11-13"],
      ["range-over-366-days", "from=2026-01-01&to=2027-01-02"],
      ["page-zero", range + "&page=0"],
      ["page-over-limit", range + "&page=100001"],
      ["malformed-department-id", range + "&departmentId=!"],
      ["unsupported-query-key", range + "&unsupported=1"],
    ]
    for (const [caseName, query] of invalidQueries) {
      const response = await request(headToken, "/audit?" + query)
      assert.equal(response.status, 400, caseName)
    }

    const maximumSearch = await request(
      headToken,
      "/audit?" + range + "&search=" + "x".repeat(100),
    )
    assert.equal(maximumSearch.status, 200, "100-character search is accepted")
    const whitespaceSearch = await request(
      headToken,
      "/audit?" + range + "&search=%20%20",
    )
    assert.equal(whitespaceSearch.status, 200, "whitespace search trims empty")
    const maximumRange = await request(
      headToken,
      "/audit?from=2026-01-01&to=2027-01-01",
    )
    assert.equal(maximumRange.status, 200, "366 inclusive dates are accepted")
    const maximumPage = await request(
      headToken,
      "/audit?" + range + "&page=100000",
    )
    assert.equal(maximumPage.status, 200, "page 100000 is accepted")
    assert.equal(((await maximumPage.json()) as { page: number }).page, 100000)

    const missingDepartment = await prisma.department.create({
      data: { name: "PG005 department to remove" },
    })
    await prisma.department.delete({ where: { id: missingDepartment.id } })
    const missing = await request(
      adminToken,
      "/audit?" +
        range +
        "&departmentId=" +
        encodeURIComponent(missingDepartment.id),
    )
    assert.equal(missing.status, 404)
  },
)

test(
  "[PG-004-F001-A002-T009] adjustment list paginates ten stable scoped rows",
  { timeout: 120000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const department = await prisma.department.create({
      data: { name: "Adjustment pagination team" },
    })
    const user = await prisma.user.create({
      data: {
        email: "adjustment-pagination@management.test",
        fullName: "Pagination Staff",
        role: "STAFF",
        passwordHash: "test-only",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "ADJ-PAGE-001",
        fullName: "Pagination Staff",
        userId: user.id,
        departmentId: department.id,
      },
    })
    const token = (await issueSession(user)).token
    const reviewer = await prisma.user.create({
      data: {
        email: "adjustment-pagination-reviewer@management.test",
        fullName: "Pagination Reviewer",
        role: "STAFF",
        passwordHash: "test-only",
        departmentId: department.id,
      },
    })
    const request = (page: string) =>
      fetch(`${base}/attendance/adjustments?scope=mine&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

    for (let index = 0; index < 11; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 10, 1, 9, index))
      await prisma.attendanceAdjustment.create({
        data: {
          employeeId: employee.id,
          requestedById: user.id,
          requestKey: randomUUID(),
          reason: `Pagination fixture ${index}`,
          proposedStartedAt: startedAt,
          proposedEndedAt: new Date(startedAt.getTime() + 60_000),
          createdAt: new Date(Date.UTC(2026, 10, 1, 0, index)),
        },
      })
    }

    const firstResponse = await request("1")
    assert.equal(firstResponse.status, 200, await firstResponse.clone().text())
    const first = (await firstResponse.json()) as {
      adjustments: { id: string }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(first.total, 11)
    assert.equal(first.page, 1)
    assert.equal(first.pageSize, 10)
    assert.equal(first.adjustments.length, 10)

    const secondResponse = await request("2")
    assert.equal(
      secondResponse.status,
      200,
      await secondResponse.clone().text(),
    )
    const second = (await secondResponse.json()) as {
      adjustments: { id: string }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(second.total, 11)
    assert.equal(second.page, 2)
    assert.equal(second.pageSize, 10)
    assert.equal(second.adjustments.length, 1)

    const expected = await prisma.attendanceAdjustment.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    })
    assert.deepEqual(
      [...first.adjustments, ...second.adjustments].map(({ id }) => id),
      expected.map(({ id }) => id),
    )

    for (const invalidPage of ["0", "1.5", "100001"]) {
      const invalid = await request(invalidPage)
      assert.equal(invalid.status, 400, `page=${invalidPage}`)
    }

    const overtimeRows = []
    const overtimeStatuses = [
      "PENDING",
      "VERIFIED",
      "APPROVED",
      "REJECTED",
    ] as const
    for (const [index, status] of overtimeStatuses.entries()) {
      const startedAt = new Date(Date.UTC(2026, 10, 2, 9, index))
      overtimeRows.push(
        await prisma.attendanceAdjustment.create({
          data: {
            employeeId: employee.id,
            requestedById: user.id,
            requestKey: randomUUID(),
            type: "OVERTIME",
            overtimeMinutes: 30 + index,
            status,
            reason:
              index === 2
                ? "Needle overtime approved search marker"
                : `Overtime status fixture ${status}`,
            proposedStartedAt: startedAt,
            proposedEndedAt: new Date(startedAt.getTime() + 60_000),
            createdAt: new Date(startedAt.getTime() + index),
            ...(status === "VERIFIED" || status === "APPROVED"
              ? {
                  verifiedById: reviewer.id,
                  verifiedAt: startedAt,
                  verificationNote: "Recorded Department Head verification",
                }
              : {}),
            ...(status === "APPROVED" || status === "REJECTED"
              ? {
                  reviewedById: reviewer.id,
                  reviewedAt: startedAt,
                  reviewNote: "Recorded final review decision",
                }
              : {}),
          },
        }),
      )
    }
    async function overtimeList(query: Record<string, string> = {}) {
      const params = new URLSearchParams({
        scope: "mine",
        page: "1",
        type: "OVERTIME",
        ...query,
      })
      return fetch(`${base}/attendance/adjustments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }

    // PG-012-F001-A005-T001: preserve the generic pagination checks above and
    // verify all four statuses filter Overtime rows at the shared API boundary.
    for (const [index, status] of overtimeStatuses.entries()) {
      const filtered = await overtimeList({ status })
      assert.equal(filtered.status, 200, `status=${status}`)
      const body = (await filtered.json()) as {
        adjustments: { id: string; type: string; status: string }[]
        total: number
      }
      assert.equal(body.total, 1, `status=${status}`)
      assert.deepEqual(
        body.adjustments.map(({ id, type, status: actual }) => [
          id,
          type,
          actual,
        ]),
        [[overtimeRows[index]!.id, "OVERTIME", status]],
      )
    }

    // PG-012-F001-A004-T002: search is supported over reason, Employee name,
    // and Employee ID; the server accepts 100 characters and rejects 101.
    for (const [search, expected] of [
      ["Needle overtime approved", [overtimeRows[2]!.id]],
      ["Pagination Staff", overtimeRows.map(({ id }) => id)],
      ["ADJ-PAGE-001", overtimeRows.map(({ id }) => id)],
    ] as const) {
      const searched = await overtimeList({ search })
      assert.equal(searched.status, 200, `search=${search}`)
      const body = (await searched.json()) as {
        adjustments: { id: string }[]
        total: number
      }
      assert.equal(body.total, expected.length, `search=${search}`)
      assert.deepEqual(
        body.adjustments.map(({ id }) => id).sort(),
        [...expected].sort(),
      )
    }
    assert.equal((await overtimeList({ search: "x".repeat(100) })).status, 200)

    // PG-012-F001-A016-T001: keep supported response projection and query
    // validation source-backed without replacing existing invalid-page checks.
    const projected = await overtimeList({ status: "APPROVED" })
    const projection = (await projected.json()) as {
      adjustments: {
        type: string
        employee: Record<string, unknown>
        capabilities: { approve: boolean; verify: boolean; reject: boolean }
      }[]
      total: number
      page: number
      pageSize: number
    }
    assert.equal(projected.status, 200)
    assert.equal(projection.total, 1)
    assert.equal(projection.page, 1)
    assert.equal(projection.pageSize, 10)
    assert.equal(projection.adjustments[0]?.type, "OVERTIME")
    assert.deepEqual(Object.keys(projection.adjustments[0]!.employee).sort(), [
      "departmentId",
      "employeeId",
      "fullName",
      "id",
    ])
    assert.deepEqual(projection.adjustments[0]?.capabilities, {
      approve: false,
      verify: false,
      reject: false,
    })
    const invalidQueries: Record<string, string>[] = [
      { status: "INVALID" },
      { type: "INVALID" },
      { scope: "organization" },
      { search: "x".repeat(101) },
    ]
    for (const query of invalidQueries)
      assert.equal(
        (await overtimeList(query)).status,
        400,
        JSON.stringify(query),
      )
  },
)
