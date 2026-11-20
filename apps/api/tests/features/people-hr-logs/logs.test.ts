import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

type LogPage = {
  total: number
  page: number
  pageSize: number
  retentionDays: number | null
  events: {
    operationId: string
    correlationId: string | null
    actor: { id: string; name: string; role: Role; attribution: string }
    effects: {
      target: { id: string; label: string | null; type: string }
      changes: { field: string; before?: unknown; after?: unknown }[]
    }[]
  }[]
}

test(
  "People & HR logs page complete operations and project only approved history",
  { timeout: 120_000 },
  async (t) => {
    const { prisma, base } = await startPgliteApp(t)
    async function createActor(role: Role) {
      const actor = await prisma.user.create({
        data: {
          role,
          fullName: role,
          email: `${role}@hr-logs.test`,
          passwordHash: "PRIVATE-HASH",
        },
      })
      return { id: actor.id, token: (await issueSession(actor)).token }
    }
    const superadmin = await createActor("SUPERADMIN")
    const admin = await createActor("ADMIN")
    const staff = await createActor("STAFF")
    const client = await createActor("USER")
    const path = "/people-hr-logs"
    function request(
      url: string,
      token = superadmin.token,
      method = "GET",
      body?: object,
    ) {
      return fetch(base + url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: body && JSON.stringify(body),
      })
    }
    async function list(query = "") {
      const response = await request(path + query)
      const body = await response.text()
      assert.equal(response.status, 200, body)
      assert.equal(response.headers.get("cache-control"), "no-store")
      assert.doesNotMatch(body, /PRIVATE|passwordHash|sessionsRevoked/)
      return JSON.parse(body) as LogPage
    }

    assert.equal((await fetch(base + path)).status, 401)
    for (const actor of [admin, staff, client])
      assert.equal((await request(path, actor.token)).status, 403)
    assert.equal((await request(path, superadmin.token, "POST")).status, 404)
    for (const filter of [
      "page=0",
      "source=ACCOUNT_MANAGEMENT",
      "event=PASSWORD_RESET",
      "actorId[]=one",
      "subjectId=bad%20id",
      "operationId=bad",
      "from=2026-03-01&to=2026-02-01",
      "from=bad",
      "search=%00",
    ])
      assert.equal((await request(`${path}?${filter}`)).status, 400, filter)
    assert.deepEqual((await list()).events, [])

    const department = await prisma.department.create({
      data: { name: "People & HR test department" },
    })
    const created = await request("/employees", admin.token, "POST", {
      employeeId: "EXP-HR-LOG",
      fullName: "Recorded Employee",
      email: "PRIVATE-EMAIL@hr-logs.test",
      password: "Private!Password1",
      contactNumber: "09123456789",
      position: "PRIVATE-POSITION",
      startDate: "2026-01-01",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
      departmentId: department.id,
      teamId: null,
    })
    assert.equal(created.status, 201, await created.clone().text())
    const { employee } = (await created.json()) as { employee: { id: string } }
    const account = await prisma.accountManagementChange.findFirstOrThrow()
    const workforce = await prisma.workforceManagementChange.findFirstOrThrow({
      where: { subjectId: employee.id },
    })
    assert.equal(account.operationId, workforce.operationId)
    const operationId = account.operationId

    // Older rows, privacy projection, and complete groups on a subject match.
    const old = new Date("2025-01-01T12:00:00.000Z")
    await prisma.accountManagementChange.update({
      where: { id: account.id },
      data: { createdAt: old },
    })
    await prisma.workforceManagementChange.updateMany({
      where: { operationId },
      data: { createdAt: old },
    })
    await prisma.workforceManagementChange.update({
      where: { id: workforce.id },
      data: {
        createdAt: old,
        changes: {
          ...(workforce.changes as object),
          email: { before: null, after: "PRIVATE-RAW-EMAIL" },
          status: { before: null, after: "PRIVATE-MALFORMED-STATUS" },
          userId: { before: null, after: account.subjectAccountId },
        },
      },
    })
    await prisma.user.update({
      where: { id: admin.id },
      data: { fullName: "Current HR Actor", role: "STAFF" },
    })
    for (const filter of [
      `subjectId=${employee.id}`,
      `subjectId=${account.subjectAccountId}&source=EMPLOYEE_MANAGEMENT`,
      `operationId=${operationId}`,
      `actorId=${admin.id}&event=CREATED`,
      "search=Current+HR+Actor",
      "from=2025-01-01&to=2025-01-02",
    ]) {
      const page = await list(`?${filter}`)
      assert.equal(page.total, 1, filter)
      assert.equal(page.retentionDays, null)
      const [operation] = page.events
      assert.equal(operation.operationId, operationId)
      assert.equal(operation.correlationId, null)
      assert.deepEqual(operation.actor, {
        id: admin.id,
        name: "Current HR Actor",
        role: "ADMIN",
        attribution: "CURRENT",
      })
      assert.equal(operation.effects[0].target.type, "Staff login")
      assert.deepEqual(
        operation.effects.map(({ target }) => target.type).sort(),
        ["Department", "Employee", "Staff login"],
      )
      const employeeEffect = operation.effects.find(
        ({ target }) => target.id === employee.id,
      )
      assert.ok(employeeEffect)
      const changes = employeeEffect.changes
      assert.ok(
        changes.some(
          (change) => change.field === "Email" && !("after" in change),
        ),
      )
      assert.ok(
        changes.some(
          (change) => change.field === "HR status" && !("after" in change),
        ),
      )
      assert.ok(
        changes.some(
          (change) =>
            change.field === "Linked account ID" &&
            change.before === null &&
            change.after === account.subjectAccountId,
        ),
      )
    }
    assert.equal((await list("?from=2025-02-01")).total, 0)
    assert.equal((await list("?search=%25")).total, 0)
    assert.equal((await list("?search=PRIVATE-RAW-EMAIL")).total, 0)

    // Verify pagination with tied dates and deleted identity fallbacks.
    const ids = Array.from({ length: 26 }, () => randomUUID())
      .sort()
      .reverse()
    await prisma.workforceManagementChange.createMany({
      data: ids.map((id) => ({
        operationId: id,
        actorAccountId: "deleted-actor",
        actorRoleAtTime: "SUPERADMIN",
        subjectId: "deleted-team",
        subjectType: "TEAM",
        action: "DELETED",
        origin: "TEAM_MANAGEMENT",
        changedFields: [],
        changes: {},
        createdAt: old,
      })),
    })
    await prisma.workforceManagementChange.create({
      data: {
        ...workforce,
        id: undefined,
        operationId,
        origin: "ACCOUNT_MANAGEMENT",
        subjectId: "outside-workspace",
        changes: {},
      },
    })
    await prisma.accountManagementChange.create({
      data: {
        ...account,
        id: undefined,
        operationId,
        origin: "CLIENT_MANAGEMENT",
        changes: {},
      },
    })
    assert.equal(
      (await list(`?operationId=${operationId}`)).events[0].effects.length,
      3,
    )
    assert.equal((await list("?subjectId=outside-workspace")).total, 0)
    const first = await list("?source=TEAM_MANAGEMENT")
    const last = await list("?source=TEAM_MANAGEMENT&page=99")
    assert.equal(first.total, 26)
    assert.equal(first.pageSize, 25)
    assert.equal(last.page, 2)
    assert.deepEqual(
      [...first.events, ...last.events].map((entry) => entry.operationId),
      ids,
    )
    assert.deepEqual(last.events[0].actor, {
      id: "deleted-actor",
      name: "deleted-actor",
      role: "SUPERADMIN",
      attribution: "UNAVAILABLE",
    })
    assert.deepEqual(last.events[0].effects[0].target, {
      id: "deleted-team",
      label: null,
      type: "Team",
    })
  },
)
