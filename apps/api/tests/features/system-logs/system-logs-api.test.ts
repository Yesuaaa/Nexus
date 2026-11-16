import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { createApp } from "../../../src/app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import {
  sources,
  type NormalizedEventV1,
} from "../../../src/features/system-logs/management-event.js"
import type { SourceStatus } from "../../../src/features/system-logs/management-history.service.js"
import { SCAN_CAP } from "../../../src/features/system-logs/management-history.repository.js"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { listen, closeServer } from "../../support/pglite-app.js"

type Page = {
  schemaVersion: 1
  events: NormalizedEventV1[]
  nextCursor: string | null
  complete: boolean
  sources: SourceStatus[]
  operationId?: string
  grouping: {
    scope: "page"
    eventCount: number
    operationCount: number
    operations: {
      operationId: string
      eventIds: string[]
      eventCount: number
    }[]
  }
}
test(
  "System Logs API is Superadmin-only and offline-gated with safe read contracts",
  { timeout: 180000 },
  async (t) => {
    assert.equal(process.env.NODE_TEST_CONTEXT, "child-v8")
    const { prisma, db, base, beforeShutdown } = await startSystemLogsApp(t)
    const operationId = randomUUID()
    const at = new Date(Date.now() - 3600000)
    const query = new URLSearchParams({
      from: new Date(at.getTime() - 1000).toISOString(),
      to: new Date(at.getTime() + 1000).toISOString(),
    })
    const list = "/management-history"
    const detail = `${list}/events/${sources[0]}/shared`
    const operation = `${list}/operations/${operationId}`
    const endpoints = [list, detail, operation]
    const users = new Map<
      Role,
      Awaited<ReturnType<typeof prisma.user.create>>
    >()
    const headers = new Map<Role, { Authorization: string }>()
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `logs-${role}`,
          email: `logs-${role}@example.test`,
          role,
          passwordHash: "credential-sentinel",
          fullName: "private-name-sentinel",
        },
      })
      users.set(role, user)
      headers.set(role, {
        Authorization: `Bearer ${(await issueSession(user)).token}`,
      })
    }
    const root = users.get(Role.SUPERADMIN)!
    const rootHeaders = headers.get(Role.SUPERADMIN)!
    async function request(
      path = list,
      suffix = query.toString(),
      auth: Record<string, string> = rootHeaders,
      origin = base,
      method = "GET",
    ) {
      const response = await fetch(
        `${origin}${path}${suffix ? `?${suffix}` : ""}`,
        { headers: auth, method },
      )
      assert.equal(response.headers.get("cache-control"), "no-store")
      const body: unknown = await response.json()
      const text = JSON.stringify(body)
      for (const secret of [
        "credential-sentinel",
        "private-name-sentinel",
        "email-sentinel",
        "raw-note-sentinel",
        "passwordHash",
        "stack",
        "PrismaClient",
        "SELECT ",
        "location",
        "devDetails",
      ])
        assert.ok(!text.includes(secret), `${path} leaked ${secret}`)
      return {
        response,
        body: body as Page & {
          error?: string
          event?: NormalizedEventV1 | null
          status?: string
          reasonCode?: string
        },
      }
    }
    await prisma.accountManagementChange.createMany({
      data: ["z", "shared", "a"].map((id) => ({
        id,
        actorAccountId: "deleted-actor",
        actorRoleAtTime: "ADMIN",
        operationId,
        subjectAccountId: "deleted-account",
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["fullName"],
        changes: {},
        createdAt: at,
      })),
    })
    await prisma.workforceManagementChange.createMany({
      data: ["z", "shared", "a"].map((id) => ({
        id,
        actorAccountId: "deleted-actor",
        actorRoleAtTime: "ADMIN",
        operationId,
        subjectType: "TEAM",
        subjectId: "deleted-team",
        action: "PROFILE_UPDATED",
        origin: "TEAM_MANAGEMENT",
        changedFields: ["description"],
        changes: {},
        createdAt: at,
      })),
    })
    await t.test(
      "default app, environment flag alone, and production all stay disabled",
      async () => {
        const previous = process.env.NODE_ENV,
          previousFlag = process.env.SYSTEM_LOGS_ENABLED
        t.after(() => {
          if (previous === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = previous
          if (previousFlag === undefined) delete process.env.SYSTEM_LOGS_ENABLED
          else process.env.SYSTEM_LOGS_ENABLED = previousFlag
        })
        const defaultServer = await listen(createApp())
        beforeShutdown(() => closeServer(defaultServer.server))
        process.env.SYSTEM_LOGS_ENABLED = "true"
        for (const path of endpoints) {
          assert.equal(
            (
              await request(
                path,
                query.toString(),
                rootHeaders,
                `${defaultServer.origin}/api/system-logs`,
              )
            ).response.status,
            404,
          )
          assert.equal((await request(path)).response.status, 200)
        }
        process.env.NODE_ENV = "production"
        const productionServer = await listen(
          createApp({ systemLogsOfflineFixture: () => true }),
        )
        beforeShutdown(() => closeServer(productionServer.server))
        try {
          for (const path of endpoints)
            assert.equal((await request(path)).response.status, 404)
        } finally {
          if (previous === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = previous
        }
        for (const path of endpoints)
          assert.equal(
            (
              await request(
                path,
                query.toString(),
                rootHeaders,
                `${productionServer.origin}/api/system-logs`,
              )
            ).response.status,
            404,
          )
        const refused = await listen(
          createApp({ systemLogsOfflineFixture: () => false }),
        )
        beforeShutdown(() => closeServer(refused.server))
        assert.equal(
          (
            await request(
              list,
              "",
              rootHeaders,
              `${refused.origin}/api/system-logs`,
            )
          ).response.status,
          404,
        )
      },
    )
    await t.test(
      "every endpoint requires authentication and exact Superadmin role before validation",
      async () => {
        for (const path of endpoints) {
          assert.equal(
            (await request(path, query.toString(), {})).response.status,
            401,
          )
          assert.equal(
            (
              await request(path, query.toString(), {
                Authorization: "Bearer forged",
              })
            ).response.status,
            401,
          )
          for (const role of [Role.ADMIN, Role.STAFF, Role.USER]) {
            const denied = await request(
              path,
              "pageSize=invalid&secret=not-allowed",
              headers.get(role)!,
            )
            assert.equal(denied.response.status, 403)
            assert.deepEqual(denied.body, { error: "Insufficient permissions" })
          }
        }
      },
    )
    await t.test(
      "current demotion, inactive, retired, expired and revoked sessions deny every endpoint",
      async () => {
        for (const data of [
          { role: Role.ADMIN },
          { role: Role.SUPERADMIN, isActive: false },
          { isActive: true, accountDeletedAt: new Date() },
        ]) {
          await prisma.user.update({ where: { id: root.id }, data })
          for (const path of endpoints)
            assert.equal(
              (await request(path)).response.status,
              "role" in data && data.role === Role.ADMIN ? 403 : 401,
            )
        }
        await prisma.user.update({
          where: { id: root.id },
          data: { role: "SUPERADMIN", isActive: true, accountDeletedAt: null },
        })
        const session = await prisma.session.findFirstOrThrow({
          where: { userId: root.id },
        })
        await prisma.session.update({
          where: { id: session.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        })
        for (const path of endpoints)
          assert.equal((await request(path)).response.status, 401)
        await prisma.session.update({
          where: { id: session.id },
          data: { expiresAt: new Date(Date.now() + 86400000) },
        })
        const disposable = await prisma.user.create({
          data: {
            id: "revoked-root",
            email: "revoked@example.test",
            passwordHash: "unused",
            role: "SUPERADMIN",
          },
        })
        const revoked = {
          Authorization: `Bearer ${(await issueSession(disposable)).token}`,
        }
        await prisma.session.deleteMany({ where: { userId: disposable.id } })
        for (const path of endpoints)
          assert.equal(
            (await request(path, query.toString(), revoked)).response.status,
            401,
          )
      },
    )
    await t.test(
      "ordering, pagination, tamper/filter/session binding and operation grouping",
      async () => {
        const ids: string[] = []
        let cursor: string | null = null
        do {
          const params = new URLSearchParams(query)
          params.set("pageSize", "2")
          if (cursor) params.set("cursor", cursor)
          const { body, response } = await request(list, params.toString())
          assert.equal(response.status, 200)
          assert.equal(body.complete, true)
          assert.equal(body.grouping.scope, "page")
          assert.equal(body.grouping.eventCount, 2)
          assert.equal(body.grouping.operationCount, 1)
          assert.deepEqual(
            body.grouping.operations[0].eventIds,
            body.events.map((e) => e.eventId),
          )
          ids.push(...body.events.map((e) => e.eventId))
          cursor = body.nextCursor
        } while (cursor)
        assert.deepEqual(
          ids,
          sources
            .slice(0, 2)
            .flatMap((source) =>
              ["z", "shared", "a"].map((id) => `${source}:${id}`),
            ),
        )
        assert.equal(new Set(ids).size, 6)
        const first = await request(list, `${query}&pageSize=2`)
        for (const suffix of [
          `${query}&pageSize=2&cursor=${first.body.nextCursor}x`,
          `${query}&pageSize=3&cursor=${first.body.nextCursor}`,
        ])
          assert.equal((await request(list, suffix)).response.status, 400)
        const otherHeaders = {
          Authorization: `Bearer ${(await issueSession(root)).token}`,
        }
        assert.equal(
          (
            await request(
              list,
              `${query}&pageSize=2&cursor=${first.body.nextCursor}`,
              otherHeaders,
            )
          ).response.status,
          400,
        )
        const grouped = await request(operation, `${query}&pageSize=2`)
        assert.equal(grouped.body.operationId, operationId)
        assert.equal(grouped.body.grouping.eventCount, 2)
        assert.equal(grouped.body.grouping.operationCount, 1)
        assert.ok(grouped.body.nextCursor)
        assert.equal(
          (
            await request(
              `${list}/operations/${randomUUID()}`,
              `${query}&pageSize=2&cursor=${grouped.body.nextCursor}`,
            )
          ).response.status,
          400,
        )
      },
    )
    await t.test(
      "allowlisted filters, conflicts, query pollution and read-only methods",
      async () => {
        for (const [filter, count] of [
          ["moduleId=people-hr", 3],
          ["source=audit.account-management", 3],
          ["actorId=deleted-actor", 6],
          ["subjectType=team", 3],
          ["subjectId=deleted-account", 3],
          ["eventName=team.profile_updated", 3],
          ["action=PROFILE_UPDATED", 6],
          [`operationId=${operationId}`, 6],
          ["actorId=missing", 0],
        ] as const) {
          const result = await request(list, `${query}&${filter}`)
          assert.equal(result.response.status, 200)
          assert.equal(result.body.events.length, count)
        }
        for (const suffix of [
          "pageSize=0",
          "pageSize=101",
          "pageSize=1.5",
          "pageSize=01",
          "pageSize=1&pageSize=2",
          "source=audit.unsupported",
          "category=security",
          "source=audit.account-management&subjectType=team",
          "subjectType=team&action=ROLE_CHANGED",
          "eventName=team.created&action=DELETED",
          "actorId=x&actorId=y",
          "actorId[x]=y",
          "__proto__=x",
          "changes=password",
          "from=invalid",
          "from=2026-01-01T00%3A00%3A00.000Z&to=2026-03-01T00%3A00%3A00.000Z",
        ]) {
          const result = await request(list, suffix)
          assert.equal(result.response.status, 400, suffix)
          assert.deepEqual(result.body, {
            error: "Invalid management history query",
          })
        }
        assert.equal(
          (await request(operation, `${query}&operationId=${operationId}`))
            .response.status,
          400,
        )
        assert.equal(
          (await request(`${list}/operations/invalid`)).response.status,
          400,
        )
        for (const method of ["POST", "PATCH", "PUT", "DELETE"])
          for (const path of endpoints)
            assert.equal(
              (await request(path, query.toString(), rootHeaders, base, method))
                .response.status,
              404,
            )
      },
    )
    await t.test(
      "safe source-aware details, deleted identities and absent events",
      async () => {
        const result = await request(detail)
        assert.equal(result.response.status, 200)
        assert.equal(result.body.event?.eventId, `${sources[0]}:shared`)
        assert.equal(result.body.event?.actor.roleAtTime, "ADMIN")
        assert.equal(result.body.event?.subject.id, "deleted-account")
        assert.equal(result.body.event?.observedAt, null)
        const team = await request(`${list}/events/${sources[1]}/shared`)
        assert.equal(team.body.event?.subject.type, "team")
        assert.notEqual(team.body.event?.eventId, result.body.event?.eventId)
        assert.equal(
          (await request(`${list}/events/${sources[0]}/absent`)).response
            .status,
          404,
        )
        for (const path of [
          `${list}/events/unknown/shared`,
          `${list}/events/${sources[0]}/bad%20id`,
        ])
          assert.equal((await request(path)).response.status, 400)
        assert.equal(
          (await request(detail, `${query}&actorId=deleted-actor`)).response
            .status,
          400,
        )
      },
    )
    await t.test(
      "development never decorates errors or echoes unsafe source JSON",
      async () => {
        const previous = process.env.NODE_ENV
        process.env.NODE_ENV = "development"
        try {
          await prisma.accountManagementChange.create({
            data: {
              id: "malformed",
              actorAccountId: "deleted-actor",
              actorRoleAtTime: "ADMIN",
              operationId,
              subjectAccountId: "deleted-account",
              action: "PROFILE_UPDATED",
              origin: "ACCOUNT_MANAGEMENT",
              changedFields: ["email"],
              changes: { email: "email-sentinel", note: "raw-note-sentinel" },
              createdAt: new Date(at.getTime() - 2000),
            },
          })
          const malformedQuery = new URLSearchParams(query)
          malformedQuery.set(
            "from",
            new Date(at.getTime() - 3000).toISOString(),
          )
          const result = await request(list, malformedQuery.toString())
          assert.equal(result.body.complete, false)
          assert.equal(result.body.sources[0].reasonCode, "INVALID_RECORD")
          assert.equal(result.body.sources[0].omittedCount, 1)
          const bad = await request(
            `${list}/events/${sources[0]}/malformed`,
            malformedQuery.toString(),
          )
          assert.equal(bad.response.status, 503)
          assert.equal(bad.body.reasonCode, "INVALID_RECORD")
          assert.deepEqual((await request(list, "unknown=private")).body, {
            error: "Invalid management history query",
          })
        } finally {
          if (previous === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = previous
        }
      },
    )
    await t.test(
      "source outages preserve partial and unavailable metadata without advancing",
      async () => {
        await db.exec(
          'ALTER TABLE "WorkforceManagementChange" RENAME TO "OfflineWorkforce"',
        )
        try {
          const partial = await request(list, `${query}&pageSize=2`)
          assert.equal(partial.response.status, 200)
          assert.equal(partial.body.complete, false)
          assert.equal(partial.body.sources[1].status, "unavailable")
          assert.equal(partial.body.nextCursor, null)
          assert.equal(
            (await request(operation)).body.sources[1].reasonCode,
            "SOURCE_UNAVAILABLE",
          )
          const all = await request(list, `${query}&source=${sources[1]}`)
          assert.equal(all.response.status, 503)
          assert.equal(all.body.sources[0].status, "unavailable")
          const detailFailure = await request(
            `${list}/events/${sources[1]}/shared`,
          )
          assert.equal(detailFailure.response.status, 503)
          assert.equal(detailFailure.body.status, "unavailable")
        } finally {
          await db.exec(
            'ALTER TABLE "OfflineWorkforce" RENAME TO "WorkforceManagementChange"',
          )
        }
      },
    )
    await t.test(
      "scan caps keep empty-page continuation and malformed counts explicit",
      async () => {
        await prisma.accountManagementChange.createMany({
          data: Array.from({ length: SCAN_CAP + 2 }, (_, i) => ({
            id: `bad-${String(i).padStart(4, "0")}`,
            actorAccountId: "deleted-actor",
            actorRoleAtTime: "ADMIN",
            operationId,
            subjectAccountId: "deleted-account",
            action: "PROFILE_UPDATED",
            origin: "ACCOUNT_MANAGEMENT",
            changedFields: ["email"],
            changes: { email: "email-sentinel" },
            createdAt: new Date(at.getTime() + 2000),
          })),
        })
        const scanQuery = new URLSearchParams(query)
        scanQuery.set("to", new Date(at.getTime() + 3000).toISOString())
        const capped = await request(list, scanQuery.toString())
        assert.equal(capped.body.events.length, 0)
        assert.equal(capped.body.complete, false)
        assert.equal(capped.body.sources[0].reasonCode, "SCAN_CAP")
        assert.equal(capped.body.sources[0].omittedCount, SCAN_CAP)
        assert.ok(capped.body.nextCursor)
        const next = await request(
          list,
          `${scanQuery}&cursor=${capped.body.nextCursor}`,
        )
        assert.equal(next.body.events.length, 6)
        assert.equal(next.body.sources[0].omittedCount, 2)
      },
    )
    await t.test(
      "API reads do not mutate domain/history tables or insert access events",
      async () => {
        const before = await db.query(
          'SELECT id, "operationId", changes FROM "AccountManagementChange" ORDER BY id',
        )
        await db.exec(`CREATE FUNCTION deny_logs_api_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'domain write from logs API'; END $$;
      DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'Session' LOOP EXECUTE format('CREATE TRIGGER logs_api_no_write BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION deny_logs_api_write()',r.tablename); END LOOP; END $$;`)
        for (const path of endpoints)
          assert.equal((await request(path)).response.status, 200)
        const after = await db.query(
          'SELECT id, "operationId", changes FROM "AccountManagementChange" ORDER BY id',
        )
        assert.deepEqual(after.rows, before.rows)
      },
    )
  },
)
