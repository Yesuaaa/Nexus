import assert from "node:assert/strict"
import { test } from "node:test"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import type { Role } from "../../../src/generated/prisma/client.js"
import { startPgliteApp } from "../../support/pglite-app.js"

test("WC-07-F02 keeps name-search membership across Workforce Logs pages", async (t) => {
  const { prisma, base } = await startPgliteApp(t)
  async function account(name: string, role: Role, suffix = "") {
    const user = await prisma.user.create({
      data: {
        fullName: name,
        role,
        email: `${name.toLowerCase().replaceAll(" ", "-")}${suffix}@paging.test`,
        passwordHash: "test-only",
      },
    })
    return { ...user, ...(await issueSession(user)) }
  }
  const hr = await account("Paging HR", "ADMIN")
  const reader = await account("Paging Reader", "SUPERADMIN")
  const otherReader = await account("Other Reader", "SUPERADMIN")
  const needle = "Audit Paging Needle"
  const actorNeedle = "Actor Paging Needle"
  const newestActor = await account(actorNeedle, "USER")
  const remainingActor = await account(actorNeedle, "USER", "-rest")
  const unrelatedActor = await account("Unrelated Actor", "USER")
  const employee = (employeeId: string, fullName: string) =>
    prisma.employee.create({ data: { employeeId, fullName } })
  const newest = await employee("EXP-PAGE-NEW", needle)
  const remaining = await employee("EXP-PAGE-REST", needle)
  const unrelated = await employee("EXP-PAGE-OTHER", "Unrelated Employee")
  const stamp = Date.now() - 60_000
  const auditRow = (
    id: string,
    employeeId: string,
    actorId: string,
    createdAt: number,
  ) => ({
    id,
    actionId: `action-${id}`,
    entityId: `session-${id}`,
    entityType: "AttendanceWorkSession",
    employeeId,
    actorId,
    action: "INSERT",
    reason: "PRIVATE-FIXTURE",
    after: {
      startedAt: new Date(stamp).toISOString(),
      endedAt: null,
      requestKey: "PRIVATE-FIXTURE",
    },
    createdAt: new Date(createdAt),
  })
  await prisma.attendanceAudit.createMany({
    data: [
      ...Array.from({ length: 27 }, (_, index) =>
        auditRow(
          `wc07-page-${index}`,
          index === 0 ? newest.id : remaining.id,
          index === 0 ? newestActor.id : remainingActor.id,
          stamp - index * 1000,
        ),
      ),
      auditRow("wc07-unrelated", unrelated.id, unrelatedActor.id, stamp + 1000),
    ],
  })

  async function request(
    path: string,
    token?: string,
    method = "GET",
    body?: object,
  ) {
    return fetch(base + path, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  }
  const endpoint = "/workforce-compliance-logs"
  const query = new URLSearchParams({ source: "time-logs", search: needle })
  async function read(params: URLSearchParams) {
    const response = await request(`${endpoint}?${params}`, reader.token)
    const text = await response.text()
    assert.equal(response.status, 200, text)
    assert.doesNotMatch(text, /PRIVATE-FIXTURE|requestKey/)
    return JSON.parse(text) as {
      total: number
      asOf: string
      snapshot: string
      page: number
      pageSize: number
      events: {
        id: string
        target: { label: string }
        actor: { name: string }
      }[]
    }
  }
  const ids = (result: Awaited<ReturnType<typeof read>>) =>
    result.events.map(({ id }) => id)
  const expected = Array.from(
    { length: 27 },
    (_, index) => `attendance:wc07-page-${index}`,
  )
  const first = await read(query)
  assert.equal(first.total, 27)
  assert.equal(first.pageSize, 25)
  assert.deepEqual(ids(first), expected.slice(0, 25))
  const pinned = (page: number, initial = first, filters = query) =>
    new URLSearchParams({
      ...Object.fromEntries(filters),
      asOf: initial.asOf,
      snapshot: initial.snapshot,
      page: String(page),
    })
  const baseline = await read(pinned(2))
  assert.deepEqual(ids(baseline), [
    "attendance:wc07-page-25",
    "attendance:wc07-page-26",
  ])
  const rename = await request(`/employees/${newest.id}`, hr.token, "PUT", {
    fullName: "Audit Changed Name",
  })
  assert.equal(rename.status, 200, await rename.clone().text())
  const afterRename = await read(pinned(2))
  assert.equal(
    afterRename.total,
    27,
    JSON.stringify({ total: afterRename.total, ids: ids(afterRename) }),
  )
  assert.deepEqual(ids(afterRename), ids(baseline))
  const renameIn = await request(
    `/employees/${unrelated.id}`,
    hr.token,
    "PUT",
    { fullName: needle },
  )
  assert.equal(renameIn.status, 200, await renameIn.clone().text())
  const actorQuery = new URLSearchParams({
    source: "time-logs",
    search: actorNeedle,
  })
  const actorFirst = await read(actorQuery)
  assert.equal(actorFirst.total, 27)
  assert.deepEqual(ids(actorFirst), expected.slice(0, 25))
  for (const [actor, fullName] of [
    [newestActor, "Renamed Actor"],
    [unrelatedActor, actorNeedle],
  ] as const) {
    const renameActor = await request(
      `/users/${actor.id}`,
      reader.token,
      "PATCH",
      { email: actor.email, fullName },
    )
    assert.equal(renameActor.status, 200, await renameActor.clone().text())
  }
  const afterActorRename = await read(pinned(2, actorFirst, actorQuery))
  assert.equal(afterActorRename.total, 27)
  assert.deepEqual(ids(afterActorRename), expected.slice(25))

  await prisma.attendanceAudit.createMany({
    data: [
      auditRow("wc07-late", remaining.id, remainingActor.id, stamp + 2000),
      auditRow("wc07-tie-a", remaining.id, remainingActor.id, stamp + 3000),
      auditRow("wc07-tie-b", remaining.id, remainingActor.id, stamp + 3000),
    ],
  })
  const state = async () => ({
    audits: await prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } }),
    employees: await prisma.employee.findMany({ orderBy: { id: "asc" } }),
    accounts: await prisma.user.findMany({ orderBy: { id: "asc" } }),
    managementChanges: await prisma.workforceManagementChange.count(),
  })
  const beforeReads = await state()
  for (const [initial, filters] of [
    [first, query],
    [actorFirst, actorQuery],
  ] as const) {
    const head = await read(pinned(1, initial, filters))
    const tail = await read(pinned(999, initial, filters))
    assert.equal(head.asOf, initial.asOf)
    assert.equal(head.snapshot, initial.snapshot)
    assert.equal(head.total, 27)
    assert.equal(tail.total, 27)
    assert.equal(tail.page, 2)
    assert.equal(head.events[0].target.label, "Audit Changed Name")
    assert.equal(head.events[0].actor.name, "Renamed Actor")
    assert.deepEqual([...ids(head), ...ids(tail)], expected)

    const fresh = await read(filters)
    assert.notEqual(fresh.snapshot, initial.snapshot)
    assert.equal(fresh.total, 30)
    const freshTail = await read(pinned(2, fresh, filters))
    assert.deepEqual(
      [...ids(fresh), ...ids(freshTail)],
      [
        "attendance:wc07-tie-b",
        "attendance:wc07-tie-a",
        "attendance:wc07-late",
        "attendance:wc07-unrelated",
        ...expected.slice(1),
      ],
    )
  }
  const emptyQuery = new URLSearchParams({ search: "PRIVATE-FIXTURE" })
  const empty = await read(emptyQuery)
  assert.equal(empty.total, 0)
  const emptyTail = await read(pinned(999, empty, emptyQuery))
  assert.equal(emptyTail.page, 1)
  assert.deepEqual(emptyTail.events, [])
  assert.deepEqual(await state(), beforeReads)

  const pageTwo = `${endpoint}?${pinned(2)}`
  assert.equal((await request(pageTwo)).status, 401)
  assert.equal((await request(pageTwo, hr.token)).status, 403)
  assert.equal((await request(pageTwo, otherReader.token)).status, 409)
  assert.equal(
    (await request(pageTwo, (await issueSession(reader)).token)).status,
    409,
  )
  for (const [key, value, status] of [
    ["snapshot", "malformed", 400],
    [
      "snapshot",
      first.snapshot.replace(/^./, first.snapshot.startsWith("0") ? "1" : "0"),
      409,
    ],
    ["snapshot", actorFirst.snapshot, 409],
    ["asOf", new Date(Date.parse(first.asOf) - 1).toISOString(), 409],
    ["search", actorNeedle, 409],
    ["source", "policies", 409],
    ["event", "CREATED", 409],
    ["range", "7d", 409],
  ] as const) {
    const params = pinned(2)
    params.set(key, value)
    assert.equal(
      (await request(`${endpoint}?${params}`, reader.token)).status,
      status,
      key,
    )
  }
  const withoutCutoff = pinned(2)
  withoutCutoff.delete("asOf")
  assert.equal(
    (await request(`${endpoint}?${withoutCutoff}`, reader.token)).status,
    400,
  )

  const future = Date.now() + 11 * 60_000
  const time = t.mock.method(Date, "now", () => future)
  try {
    const expired = await request(pageTwo, reader.token)
    assert.equal(expired.status, 409)
    assert.match(await expired.text(), /Refresh logs/)
  } finally {
    time.mock.restore()
  }
  const revocable = await read(query)
  assert.equal(
    (await request("/auth/logout", reader.token, "POST")).status,
    204,
  )
  assert.equal(
    (await request(`${endpoint}?${pinned(2, revocable)}`, reader.token)).status,
    401,
  )
})
