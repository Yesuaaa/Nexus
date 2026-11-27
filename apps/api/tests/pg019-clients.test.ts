import assert from "node:assert/strict"
import { test } from "node:test"
import { signAccessToken } from "../src/features/auth/auth.jwt.js"
import { startPgliteApp } from "./support/pglite-app.js"
import {
  seedPg019,
  clientInput,
  clientSnapshot,
} from "./support/pg019-client-fixture.js"
const options = { timeout: 120000 }
async function request(
  origin: string,
  token: string,
  path = "",
  method = "GET",
  body?: unknown,
) {
  return fetch(origin + "/api/clients" + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      "x-role": "SUPERADMIN",
      "x-permissions": "clients:read,clients:create",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
const keys = [
  "id",
  "fullName",
  "email",
  "contactNumber",
  "isActive",
  "createdAt",
].sort()

test(
  "[PG-019-F001-A001-T004] Client endpoints recheck session, active state and current role including Head denial",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    const operations = [
      ["", "GET"],
      [`/${f.a.user.id}`, "GET"],
      [`/${f.a.user.id}/projects`, "GET"],
      [`/${f.a.user.id}/service-requests`, "GET"],
      ["", "POST"],
      [`/${f.a.user.id}`, "PATCH"],
      [`/${f.a.user.id}`, "DELETE"],
    ] as const
    async function denied(token: string, status: number, code?: string) {
      const before = await clientSnapshot(prisma)
      for (const [path, method] of operations) {
        const response = await request(
          origin,
          token,
          path,
          method,
          method === "POST" || method === "PATCH" ? clientInput : undefined,
        )
        assert.equal(response.status, status, method + path)
        const payload = (await response.json()) as {
          error: string
          code?: string
        }
        assert.deepEqual(
          Object.keys(payload).sort(),
          code ? ["code", "error"] : ["error"],
        )
        if (code) assert.equal(payload.code, code)
      }
      assert.deepEqual(await clientSnapshot(prisma), before)
    }
    await denied("", 401)
    await denied("invalid.token.value", 401, "INVALID_ACCESS_TOKEN")
    const rootSession = await prisma.session.findFirstOrThrow({
      where: { userId: f.root.user.id },
    })
    const expired = await signAccessToken(
      f.root.user.id,
      rootSession.id,
      new Date("2000-01-01"),
    )
    await denied(expired.token, 401, "ACCESS_TOKEN_EXPIRED")
    for (const actor of [f.staff, f.head, f.a]) await denied(actor.token, 403)
    for (const data of [
      { isActive: false },
      { isActive: true, accountDeletedAt: new Date() },
      { accountDeletedAt: null, isActive: true, role: "STAFF" as const },
    ]) {
      await prisma.user.update({ where: { id: f.admin.user.id }, data })
      await denied(f.admin.token, data.role ? 403 : 401)
    }
    await prisma.user.update({
      where: { id: f.admin.user.id },
      data: { role: "ADMIN" },
    })
    await prisma.session.updateMany({
      where: { userId: f.admin.user.id },
      data: { expiresAt: new Date("2000-01-01") },
    })
    await denied(f.admin.token, 401)
    await prisma.session.deleteMany({ where: { userId: f.admin.user.id } })
    await denied(f.admin.token, 401)
    assert.equal((await request(origin, f.root.token)).status, 200)
  },
)

test(
  "[PG-019-F001-A011-T001] related projects and counts exclude request placeholders and retain exact parent projections",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    const legacy = await prisma.project.create({
      data: { clientId: f.a.user.id, name: "Legacy null start" },
    })
    const serviceId = f.records[0]!.request.serviceId
    const placeholderRequest = await prisma.serviceRequest.create({
      data: { clientId: f.a.user.id, serviceId, title: "Placeholder request" },
    })
    await prisma.project.create({
      data: {
        clientId: f.a.user.id,
        requestId: placeholderRequest.id,
        name: "Hidden placeholder",
      },
    })
    await prisma.user.update({
      where: { id: f.a.user.id },
      data: { isActive: false },
    })
    const before = await clientSnapshot(prisma)
    for (const [actor, client, expected] of [
      [f.admin, f.a, [f.records[0]!.project.id, legacy.id]],
      [f.root, f.b, [f.records[1]!.project.id]],
    ] as const) {
      const summary = await request(origin, actor.token, `/${client.user.id}`)
      assert.equal(summary.status, 200)
      const detail = (await summary.json()) as {
        client: object
        projectCount: number
      }
      assert.equal(detail.projectCount, expected.length)
      assert.deepEqual(Object.keys(detail.client).sort(), keys)
      const response = await request(
        origin,
        actor.token,
        `/${client.user.id}/projects?clientId=${f.b.user.id}`,
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        projects: { id: string; startDate: string | null }[]
        total: number
      }
      assert.equal(body.total, expected.length)
      assert.deepEqual(
        body.projects.map((p) => p.id).sort(),
        [...expected].sort(),
      )
      for (const project of body.projects)
        assert.deepEqual(
          Object.keys(project).sort(),
          ["id", "name", "status", "startDate", "createdAt"].sort(),
        )
      if (client.user.id === f.a.user.id)
        assert.equal(
          body.projects.find((p) => p.id === legacy.id)?.startDate,
          null,
        )
      assert.equal(JSON.stringify(body).includes("PRIVATE"), false)
    }
    assert.deepEqual(await clientSnapshot(prisma), before)
  },
)

test(
  "[PG-019-F001-A015-T002] server rejects invalid raw profiles and enforces actual password byte boundaries independently",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    const bad: unknown[] = [
      null,
      [],
      "text",
      {},
      ...["", " ", "X", "x".repeat(101), 42].map((fullName) => ({
        ...clientInput,
        fullName,
      })),
      ...[null, 42, "bad", "a".repeat(245) + "@example.test"].map((email) => ({
        ...clientInput,
        email,
      })),
      ...["123456", "1".repeat(21), "abc1234", null, 42].map(
        (contactNumber) => ({ ...clientInput, contactNumber }),
      ),
      { ...clientInput, isActive: "false" },
      ...[
        "short",
        "onlylowercase123!",
        "ONLYUPPERCASE123!",
        "NoNumberPassword!",
        "NoSpecialPassword123",
        "Aa1!" + "x".repeat(1021),
      ].map((password) => ({ ...clientInput, password })),
    ]
    const before = await clientSnapshot(prisma)
    for (const body of bad) {
      const response = await request(origin, f.admin.token, "", "POST", body)
      assert.equal(response.status, 400, JSON.stringify(body))
      assert.deepEqual(await clientSnapshot(prisma), before)
    }
    const maximum = await request(origin, f.admin.token, "", "POST", {
      ...clientInput,
      fullName: "N".repeat(100),
      email: "a".repeat(241) + "@example.test",
      contactNumber: "1".repeat(20),
    })
    assert.equal(maximum.status, 201)
    assert.deepEqual(
      Object.keys(((await maximum.json()) as { client: object }).client).sort(),
      keys,
    )
    for (const [index, password] of [
      "Aa1!" + "x".repeat(8),
      "Aa1!" + "x".repeat(1020),
      "Aa1!" + "x".repeat(1018) + "\u00e9",
    ].entries()) {
      assert.ok(Buffer.byteLength(password) <= 1024)
      const response = await request(origin, f.admin.token, "", "POST", {
        ...clientInput,
        fullName: "\u674e\u5c71",
        contactNumber: "1234567",
        email: `valid-${index}@pg019.test`,
        password,
        id: "forged-client-id",
        role: "SUPERADMIN",
        employeeId: "forged-employee",
        clientId: f.b.user.id,
        passwordHash: "FORGED-HASH",
        accountDeletedAt: "2000-01-01",
        actorAccountId: f.head.user.id,
      })
      assert.equal(response.status, 201)
      const created = (await response.json()) as { client: { id: string } }
      assert.deepEqual(Object.keys(created.client).sort(), keys)
      assert.notEqual(created.client.id, "forged-client-id")
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: created.client.id },
      })
      assert.equal(stored.role, "USER")
      assert.equal(stored.accountDeletedAt, null)
      assert.notEqual(stored.passwordHash, "FORGED-HASH")
      assert.equal(await prisma.employee.count(), 0)
    }
    const after = await clientSnapshot(prisma)
    assert.equal(
      (
        await request(origin, f.admin.token, "", "POST", {
          ...clientInput,
          password: "Aa1!" + "x".repeat(1019) + "\u00e9",
        })
      ).status,
      400,
    )
    assert.deepEqual(await clientSnapshot(prisma), after)
    const oldHash = (
      await prisma.user.findUniqueOrThrow({ where: { id: f.a.user.id } })
    ).passwordHash
    assert.equal(
      (
        await request(origin, f.root.token, `/${f.a.user.id}`, "PATCH", {
          ...clientInput,
          email: "updated@pg019.test",
          password: null,
          role: "SUPERADMIN",
        })
      ).status,
      200,
    )
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.a.user.id } }))
        .passwordHash,
      oldHash,
    )
  },
)

test(
  "[PG-019-F001-A021-T002] malformed and bounded JSON and domain faults expose only safe HTTP errors",
  options,
  async (t) => {
    const { prisma, db, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    const before = await clientSnapshot(prisma)
    for (const [body, status, error] of [
      ["{", 400, "Invalid JSON"],
      [
        JSON.stringify({ value: "x".repeat(16385) }),
        413,
        "Request payload is too large",
      ],
    ] as const) {
      const response = await fetch(origin + "/api/clients", {
        method: "POST",
        headers: {
          authorization: "Bearer " + f.admin.token,
          "content-type": "application/json",
        },
        body,
      })
      assert.equal(response.status, status)
      assert.deepEqual(await response.json(), { error })
      assert.equal(response.headers.get("cache-control"), "no-store")
    }
    await db.exec(
      `CREATE FUNCTION pg019_reject_history() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'PRIVATE SQL SENTINEL'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER pg019_reject_history BEFORE INSERT ON "AccountManagementChange" FOR EACH ROW EXECUTE FUNCTION pg019_reject_history();`,
    )
    try {
      const response = await request(
        origin,
        f.admin.token,
        "",
        "POST",
        clientInput,
      )
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), {
        error: "Internal server error",
      })
      assert.deepEqual(await clientSnapshot(prisma), before)
    } finally {
      await db.exec(
        `DROP TRIGGER pg019_reject_history ON "AccountManagementChange"; DROP FUNCTION pg019_reject_history();`,
      )
    }
    const conflict = await request(origin, f.admin.token, "", "POST", {
      ...clientInput,
      email: f.root.user.email,
    })
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), {
      error: "An account with this email already exists.",
    })
    assert.deepEqual(await clientSnapshot(prisma), before)
  },
)

test(
  "[PG-019-F001-A022-T001] literal LIKE and SQL-like searches cannot broaden parent or field scope",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    const values = [
      "Percent % sentinel",
      "Under_score sentinel",
      "Back\\slash sentinel",
      "Quote ' sentinel",
      "x OR 1=1",
    ]
    for (const [i, fullName] of values.entries())
      await prisma.user.create({
        data: {
          id: `literal-${i}`,
          fullName,
          email: `literal-${i}@pg019.test`,
          passwordHash: "synthetic-only",
          role: "USER",
        },
      })
    const before = await clientSnapshot(prisma)
    for (const [query, id] of [
      ["%", "literal-0"],
      ["_", "literal-1"],
      ["\\", "literal-2"],
      ["'", "literal-3"],
      ["x OR 1=1", "literal-4"],
    ]) {
      const response = await request(
        origin,
        f.admin.token,
        "?search=" +
          encodeURIComponent(query) +
          "&role=SUPERADMIN&clientId=" +
          f.b.user.id,
      )
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        clients: { id: string }[]
        total: number
      }
      assert.equal(body.total, 1)
      assert.deepEqual(
        body.clients.map((c) => c.id),
        [id],
      )
      assert.deepEqual(Object.keys(body.clients[0]!).sort(), keys)
    }
    assert.deepEqual(await clientSnapshot(prisma), before)
  },
)

test(
  "[PG-019-F001-A022-T003] finite query grammar and maximum pages retain ten-row resource and projection bounds",
  options,
  async (t) => {
    const { prisma, origin } = await startPgliteApp(t)
    const f = await seedPg019(prisma)
    for (let i = 0; i < 11; i++)
      await prisma.user.create({
        data: {
          email: `bounded-${i}@pg019.test`,
          passwordHash: "test-only",
          role: "USER",
        },
      })
    const before = await clientSnapshot(prisma)
    for (const query of [
      "page=0",
      "page=-1",
      "page=1.5",
      "page=100001",
      "page=1&page=2",
      "page=%5Bobject%20Object%5D",
      "search=a&search=b",
      "status=ACTIVE&status=INACTIVE",
      "sortBy=email&sortBy=fullName",
      "sortOrder=asc&sortOrder=desc",
      "sortBy=passwordHash",
      "search=" + "x".repeat(101),
    ])
      assert.equal(
        (await request(origin, f.admin.token, "?" + query)).status,
        400,
        query,
      )
    for (const query of [
      "page=100000",
      "page=1&pageSize=999999",
      "page[x]=1",
      "search=" + "x".repeat(100),
    ]) {
      const response = await request(origin, f.admin.token, "?" + query)
      assert.equal(response.status, 200)
      const body = (await response.json()) as {
        clients: object[]
        pageSize: number
      }
      assert.equal(body.pageSize, 10)
      assert.ok(body.clients.length <= 10)
      if (query.startsWith("page=100000")) assert.deepEqual(body.clients, [])
    }
    assert.deepEqual(await clientSnapshot(prisma), before)
  },
)
