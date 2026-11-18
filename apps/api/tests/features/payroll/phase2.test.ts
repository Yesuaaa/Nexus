import assert from "node:assert/strict"
import { test } from "node:test"
import { Role } from "../../../src/generated/prisma/client.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { startPgliteApp } from "../../support/pglite-app.js"

function manilaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

test(
  "Payroll Phase 2 endpoints enforce the Payroll read and manage roles",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function actor(
      key: string,
      role: Role,
      options: { active?: boolean; deleted?: boolean } = {},
    ) {
      const user = await prisma.user.create({
        data: {
          id: `payroll-${key}`,
          role,
          email: `${key}@payroll.test`,
          passwordHash: "not-a-real-password-hash",
          isActive: options.active ?? true,
          accountDeletedAt: options.deleted
            ? new Date("2026-11-15T00:00:00.000Z")
            : null,
        },
      })
      return {
        headers: {
          Authorization: `Bearer ${(await issueSession(user)).token}`,
        },
      }
    }

    const admin = await actor("admin", Role.ADMIN)
    const superadmin = await actor("superadmin", Role.SUPERADMIN)
    const staff = await actor("staff", Role.STAFF)
    const client = await actor("client", Role.USER)
    const inactiveAdmin = await actor("inactive-admin", Role.ADMIN, {
      active: false,
    })
    const deletedSuperadmin = await actor(
      "deleted-superadmin",
      Role.SUPERADMIN,
      {
        deleted: true,
      },
    )

    const employee = await prisma.employee.create({
      data: {
        employeeId: "PAY-ROLE-001",
        fullName: "Payroll Role Test",
      },
    })
    const readable = [
      "/payroll/compensation",
      `/payroll/compensation/${employee.id}`,
      `/payroll/compensation/${employee.id}/history`,
      "/payroll/settings",
      "/payroll/settings/history",
    ]

    for (const path of readable) {
      for (const user of [admin, superadmin]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(response.status, 200, `${path} should be readable`)
      }
      for (const user of [staff, client]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(
          response.status,
          403,
          `${path} should deny workforce roles`,
        )
      }
      for (const user of [inactiveAdmin, deletedSuperadmin]) {
        const response = await fetch(`${base}${path}`, {
          headers: user.headers,
        })
        assert.equal(
          response.status,
          401,
          `${path} should deny inactive accounts`,
        )
      }
      const anonymous = await fetch(`${base}${path}`)
      assert.equal(anonymous.status, 401, `${path} should require a session`)
    }

    const writeRequests = [
      ["/payroll/compensation/no-employee/versions", { payType: "MONTHLY" }],
      ["/payroll/settings/versions", { frequency: "MONTHLY" }],
    ] as const
    for (const [path, body] of writeRequests) {
      for (const user of [superadmin, staff, client]) {
        const response = await fetch(`${base}${path}`, {
          method: "POST",
          headers: { ...user.headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        assert.equal(
          response.status,
          403,
          `${path} should require payroll manage`,
        )
      }
      const anonymous = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      assert.equal(anonymous.status, 401, `${path} should require a session`)
    }
  },
)

test(
  "Payroll compensation and settings retain exact, effective-dated history",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const adminUser = await prisma.user.create({
      data: {
        id: "payroll-phase2-admin",
        role: Role.ADMIN,
        email: "phase2-admin@payroll.test",
        passwordHash: "not-a-real-password-hash",
      },
    })
    const superadminUser = await prisma.user.create({
      data: {
        id: "payroll-phase2-superadmin",
        role: Role.SUPERADMIN,
        email: "phase2-superadmin@payroll.test",
        passwordHash: "not-a-real-password-hash",
      },
    })
    const adminToken = (await issueSession(adminUser)).token
    const superadminToken = (await issueSession(superadminUser)).token
    const department = await prisma.department.create({
      data: { name: "Payroll Phase 2 Department" },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "PAY-COMP-001",
        fullName: "Compensation History Test",
        departmentId: department.id,
      },
    })
    const request = (path: string, token = adminToken, body?: unknown) =>
      fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })

    const initial = {
      payType: "MONTHLY",
      baseRate: "72500.10",
      currency: "PHP",
      effectiveFrom: manilaToday(),
      changeReason: "Initial compensation setup",
      components: [
        {
          type: "ALLOWANCE",
          name: "Transport",
          amount: "1250.05",
        },
        {
          type: "RECURRING_DEDUCTION",
          name: "Equipment plan",
          amount: "200.01",
        },
      ],
    }
    assert.equal(
      (await request("/payroll/compensation/no-such-employee")).status,
      404,
    )
    assert.equal(
      (
        await request(
          "/payroll/compensation/no-such-employee/versions",
          adminToken,
          initial,
        )
      ).status,
      404,
    )
    for (const invalid of [
      { ...initial, baseRate: "72500.105" },
      { ...initial, baseRate: "1e5" },
      { ...initial, baseRate: "-1.00" },
      { ...initial, baseRate: "0.00" },
      { ...initial, baseRate: "Infinity" },
      { ...initial, baseRate: "NaN" },
      { ...initial, baseRate: "10,000.00" },
      { ...initial, baseRate: "10000000000.00" },
      { ...initial, effectiveFrom: "2026-02-30" },
      { ...initial, currency: "USD" },
      {
        ...initial,
        components: [{ type: "ALLOWANCE", name: "Bad", amount: "-1.00" }],
      },
    ]) {
      const response = await request(
        `/payroll/compensation/${employee.id}/versions`,
        adminToken,
        invalid,
      )
      assert.equal(response.status, 400, await response.text())
    }

    const firstResponse = await request(
      `/payroll/compensation/${employee.id}/versions`,
      adminToken,
      initial,
    )
    assert.equal(firstResponse.status, 201, await firstResponse.clone().text())
    await prisma.employee.createMany({
      data: Array.from({ length: 21 }, (_, index) => {
        const number = String(index + 1).padStart(2, "0")
        return {
          employeeId: `PAY-PAGE-${number}`,
          fullName: `Directory Employee ${number}`,
          departmentId: department.id,
        }
      }),
    })
    async function directory(params: Record<string, string>) {
      const response = await request(
        "/payroll/compensation?" + new URLSearchParams(params),
      )
      assert.equal(response.status, 200)
      return (await response.json()) as {
        total: number
        page: number
        pageSize: number
        rows: {
          employee: { employeeId: string }
          configurationStatus: string
        }[]
      }
    }
    const pages = await Promise.all(
      [1, 2, 3].map((page) => directory({ page: String(page) })),
    )
    assert.deepEqual(
      pages.map(({ total, pageSize, rows }) => [total, pageSize, rows.length]),
      [
        [22, 10, 10],
        [22, 10, 10],
        [22, 10, 2],
      ],
    )
    assert.deepEqual(
      pages.flatMap(({ rows }) =>
        rows.map(({ employee }) => employee.employeeId),
      ),
      [
        "PAY-COMP-001",
        ...Array.from(
          { length: 21 },
          (_, index) => `PAY-PAGE-${String(index + 1).padStart(2, "0")}`,
        ),
      ],
    )
    assert.equal((await directory({ departmentId: department.id })).total, 22)
    assert.equal((await directory({ status: "NOT_CONFIGURED" })).total, 21)
    assert.equal(
      (await directory({ search: "PAY-PAGE-21", status: "NOT_CONFIGURED" }))
        .total,
      1,
    )
    const configured = await directory({
      search: "Compensation History",
      departmentId: department.id,
      payType: "MONTHLY",
      status: "CONFIGURED",
    })
    assert.equal(configured.total, 1)
    assert.equal(configured.rows[0]?.employee.employeeId, "PAY-COMP-001")
    assert.equal((await directory({ payType: "HOURLY" })).total, 0)
    assert.equal((await request("/payroll/compensation?page=0")).status, 400)
    const first = (await firstResponse.json()) as {
      compensation: {
        id: string
        baseRate: string
        effectiveFrom: string
        effectiveTo: string | null
        components: { amount: string }[]
      }
    }
    assert.equal(first.compensation.baseRate, "72500.10")
    assert.equal(first.compensation.effectiveTo, null)
    assert.deepEqual(
      first.compensation.components.map((component) => component.amount),
      ["1250.05", "200.01"],
    )

    const futureResponse = await request(
      `/payroll/compensation/${employee.id}/versions`,
      adminToken,
      {
        ...initial,
        payType: "DAILY",
        baseRate: "3456.78",
        effectiveFrom: "2099-04-01",
        changeReason: "Future rate revision",
        components: [],
      },
    )
    assert.equal(
      futureResponse.status,
      201,
      await futureResponse.clone().text(),
    )
    const future = (await futureResponse.json()) as {
      compensation: { id: string; baseRate: string }
    }
    assert.equal(future.compensation.baseRate, "3456.78")

    const duplicateDate = await request(
      `/payroll/compensation/${employee.id}/versions`,
      adminToken,
      {
        ...initial,
        effectiveFrom: "2099-04-01",
        changeReason: "Duplicate effective date",
        components: [],
      },
    )
    assert.equal(duplicateDate.status, 409)

    const historyResponse = await request(
      `/payroll/compensation/${employee.id}/history`,
    )
    assert.equal(historyResponse.status, 200)
    const history = (await historyResponse.json()) as {
      rows: { id: string; baseRate: string; effectiveFrom: string }[]
    }
    assert.equal(history.rows.length, 2)
    assert.equal(history.rows[0].baseRate, "3456.78")
    assert.equal(history.rows[1].baseRate, "72500.10")
    assert.equal(history.rows[1].effectiveFrom, manilaToday())

    const details = await request(`/payroll/compensation/${employee.id}`)
    assert.equal(details.status, 200)
    const detailBody = (await details.json()) as {
      current: { baseRate: string } | null
      future: { baseRate: string } | null
    }
    assert.equal(detailBody.current?.baseRate, "72500.10")
    assert.equal(detailBody.future?.baseRate, "3456.78")

    const list = await request(
      "/payroll/compensation?search=PAY-COMP-001&departmentId=" +
        encodeURIComponent(department.id),
    )
    assert.equal(list.status, 200)
    const listBody = (await list.json()) as {
      rows: {
        compensation: { baseRate: string } | null
        configurationStatus: string
      }[]
    }
    assert.equal(listBody.rows.length, 1)
    assert.equal(listBody.rows[0].compensation?.baseRate, "72500.10")
    assert.equal(listBody.rows[0].configurationStatus, "CONFIGURED")

    const unrelatedEmployees = await request("/employees?search=PAY-COMP-001")
    assert.equal(unrelatedEmployees.status, 200)
    const employeeResponseBody = await unrelatedEmployees.text()
    assert.ok(!employeeResponseBody.includes("72500.10"))
    assert.ok(!employeeResponseBody.includes("1250.05"))
    assert.ok(!employeeResponseBody.includes("baseRate"))

    const compensationAudit = await prisma.workforceManagementChange.findMany({
      where: {
        subjectType: "COMPENSATION",
        subjectId: employee.id,
      },
    })
    assert.equal(compensationAudit.length, 2)
    const compensationAuditJson = JSON.stringify(compensationAudit)
    assert.ok(compensationAuditJson.includes(first.compensation.id))
    assert.ok(compensationAuditJson.includes(future.compensation.id))
    assert.ok(compensationAuditJson.includes("Initial compensation setup"))
    assert.ok(!compensationAuditJson.includes("72500.10"))
    assert.ok(!compensationAuditJson.includes("1250.05"))

    const invalidSchedule = await request(
      "/payroll/settings/versions",
      adminToken,
      {
        frequency: "SEMI_MONTHLY",
        firstCutoffDay: 31,
        effectiveFrom: manilaToday(),
        currency: "PHP",
        changeReason: "Bad cutoff",
      },
    )
    assert.equal(invalidSchedule.status, 400)

    const monthly = await request("/payroll/settings/versions", adminToken, {
      frequency: "MONTHLY",
      firstCutoffDay: null,
      effectiveFrom: manilaToday(),
      currency: "PHP",
      changeReason: "Initial monthly schedule",
    })
    assert.equal(monthly.status, 201, await monthly.clone().text())
    const monthlyBody = (await monthly.json()) as {
      configuration: { frequency: string; periods: { startDay: number }[] }
    }
    assert.equal(monthlyBody.configuration.frequency, "MONTHLY")
    assert.equal(monthlyBody.configuration.periods[0].startDay, 1)

    const semiMonthly = await request(
      "/payroll/settings/versions",
      adminToken,
      {
        frequency: "SEMI_MONTHLY",
        firstCutoffDay: 15,
        effectiveFrom: "2099-04-01",
        currency: "PHP",
        changeReason: "Future semi-monthly schedule",
      },
    )
    assert.equal(semiMonthly.status, 201, await semiMonthly.clone().text())
    const semiMonthlyBody = (await semiMonthly.json()) as {
      configuration: {
        periods: { startDay: number; endDay: number | string }[]
      }
    }
    assert.deepEqual(semiMonthlyBody.configuration.periods, [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: "LAST_DAY" },
    ])

    const settings = await request("/payroll/settings")
    assert.equal(settings.status, 200)
    const { capabilities } = (await settings.json()) as {
      capabilities: Record<string, unknown>
    }
    assert.deepEqual(capabilities, {
      simulatorEnabled:
        process.env.NODE_ENV === "development" &&
        process.env.PAYROLL_LOCAL_SIMULATOR === "true",
      payMongoEnabled: false,
      sandboxDestinationKinds: ["TEST_BANK", "TEST_EWALLET"],
    })
    const settingsHistory = await request("/payroll/settings/history")
    assert.equal(settingsHistory.status, 200)
    const settingsBody = (await settingsHistory.json()) as {
      rows: { frequency: string; effectiveTo: string | null }[]
    }
    assert.equal(settingsBody.rows.length, 2)
    assert.equal(settingsBody.rows[0].frequency, "SEMI_MONTHLY")
    assert.equal(settingsBody.rows[1].frequency, "MONTHLY")
    assert.equal(settingsBody.rows[1].effectiveTo, "2099-03-31")

    const configAudit = await prisma.workforceManagementChange.findMany({
      where: { subjectType: "PAYROLL_CONFIGURATION" },
    })
    assert.equal(configAudit.length, 2)
    assert.ok(
      JSON.stringify(configAudit).includes("Future semi-monthly schedule"),
    )

    const superadminWrite = await request(
      `/payroll/compensation/${employee.id}/versions`,
      superadminToken,
      initial,
    )
    assert.equal(superadminWrite.status, 403)
  },
)

test(
  "simultaneous Payroll revisions cannot create overlapping compensation intervals",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    const user = await prisma.user.create({
      data: {
        id: "payroll-concurrent-admin",
        role: Role.ADMIN,
        email: "concurrent-admin@payroll.test",
        passwordHash: "not-a-real-password-hash",
      },
    })
    const employee = await prisma.employee.create({
      data: {
        employeeId: "PAY-CONCURRENT-001",
        fullName: "Concurrent Revision Test",
      },
    })
    const token = (await issueSession(user)).token
    const create = (effectiveFrom: string) =>
      fetch(`${base}/payroll/compensation/${employee.id}/versions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payType: "MONTHLY",
          baseRate: "50000.00",
          currency: "PHP",
          effectiveFrom,
          changeReason: "Concurrent revision race",
          components: [],
        }),
      })
    const initial = await create("2026-01-01")
    assert.equal(initial.status, 201, await initial.clone().text())
    const [first, second] = await Promise.all([
      create("2099-01-01"),
      create("2100-01-01"),
    ])
    assert.ok([201, 409].includes(first.status))
    assert.ok([201, 409].includes(second.status))
    assert.ok(first.status === 201 || second.status === 201)

    const versions = await prisma.employeeCompensation.findMany({
      where: { employeeId: employee.id },
      orderBy: { effectiveFrom: "asc" },
    })
    assert.ok(versions.length >= 2)
    for (let index = 0; index < versions.length - 1; index++) {
      const priorEnd = versions[index].effectiveTo
      assert.ok(priorEnd)
      assert.ok(priorEnd < versions[index + 1].effectiveFrom)
    }
  },
)
