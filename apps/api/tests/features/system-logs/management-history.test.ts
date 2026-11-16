import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import { test } from "node:test"
import type { AuthContext } from "../../../src/features/auth/auth.middleware.js"
import {
  normalizeManagementEvent,
  sources,
} from "../../../src/features/system-logs/management-event.js"
import {
  parseManagementQuery,
  encodeCursor,
} from "../../../src/features/system-logs/management-query.js"
import {
  listManagementHistory,
  getManagementHistoryEvent,
} from "../../../src/features/system-logs/management-history.service.js"
import { SCAN_CAP } from "../../../src/features/system-logs/management-history.repository.js"
import { applyMigrations, startPgliteApp } from "../../support/pglite-app.js"

const operation = randomUUID()
const now = new Date()
const at = new Date(now.getTime() - 3600000)
const range = {
  from: new Date(at.getTime() - 1000).toISOString(),
  to: new Date(at.getTime() + 1000).toISOString(),
}
function account(id = "shared") {
  return {
    id,
    actorAccountId: "deleted-actor",
    actorRoleAtTime: "ADMIN",
    operationId: operation,
    subjectAccountId: "deleted-subject",
    action: "PROFILE_UPDATED",
    origin: "ACCOUNT_MANAGEMENT",
    changedFields: ["fullName"],
    changes: {},
    createdAt: at,
  }
}
function workforce(id = "shared") {
  return {
    id,
    actorAccountId: "deleted-actor",
    actorRoleAtTime: "ADMIN",
    operationId: operation,
    subjectType: "TEAM",
    subjectId: "deleted-team",
    action: "PROFILE_UPDATED",
    origin: "TEAM_MANAGEMENT",
    changedFields: ["description"],
    changes: {},
    createdAt: at,
  }
}
test("management normalization fails closed and preserves historical identity without enrichment", () => {
  const row = account()
  const event = normalizeManagementEvent(sources[0], row)!
  assert.equal(event.actor.roleAtTime, "ADMIN")
  assert.equal(event.actor.accountId, "deleted-actor")
  assert.equal(event.subject.id, "deleted-subject")
  assert.equal(event.correlation.operationId, operation)
  assert.equal(event.occurredAt, at.toISOString())
  assert.equal(event.observedAt, null)
  assert.equal(event.eventId, `${sources[0]}:shared`)
  assert.equal(
    normalizeManagementEvent(sources[1], workforce())!.moduleId,
    "people-hr",
  )
  const unknown = normalizeManagementEvent(sources[0], {
    ...row,
    actorRoleAtTime: null,
  })!
  assert.equal(unknown.actor.roleAtTime, null)
  assert.equal(unknown.actor.roleEvidence, "not-recorded")
  assert.equal(
    normalizeManagementEvent(sources[0], {
      ...row,
      actorAccountId: null,
      actorRoleAtTime: null,
    })!.actor.kind,
    "unknown",
  )
  for (const bad of [
    null,
    [],
    { ...row, fullName: "personal-sentinel" },
    { ...row, changes: { fullName: "personal-sentinel" } },
    { ...row, changes: { password: "secret-sentinel" } },
    { ...row, actorRoleAtTime: "OWNER" },
    { ...row, operationId: "forged" },
    { ...row, createdAt: new Date("invalid") },
    { ...row, changedFields: ["email", "email"] },
    { ...row, origin: "TEAM_MANAGEMENT" },
    { ...row, action: "toString" },
    {
      ...row,
      changes: { isActive: { before: true, after: { secret: "sentinel" } } },
    },
  ]) {
    assert.equal(normalizeManagementEvent(sources[0], bad), null)
  }
  assert.equal(
    normalizeManagementEvent(sources[1], {
      ...workforce(),
      action: "STATUS_CHANGED",
    }),
    null,
  )
  const reset = normalizeManagementEvent(sources[0], {
    ...row,
    action: "PASSWORD_RESET",
    changedFields: [],
    changes: { sessionsRevoked: true },
  })!
  assert.deepEqual(reset.details.transitions, {})
  assert.equal(reset.details.sessionsRevoked, true)
  const lead = normalizeManagementEvent(sources[1], {
    ...workforce(),
    action: "LEAD_CHANGED",
    changedFields: ["leadId"],
    changes: { leadId: { before: "old-lead", after: "new-lead" } },
  })!
  assert.deepEqual(lead.details.transitions, {
    leadId: { before: "old-lead", after: "new-lead" },
  })
})

test("management query validation rejects unbounded, unsupported and conflicting input", () => {
  for (const bad of [
    null,
    [],
    { token: "secret" },
    { pageSize: 101 },
    { pageSize: "10" },
    { pageSize: 0 },
    { category: "security" },
    { area: "platform" },
    { source: "audit.unsupported" },
    { moduleId: "billing-finance" },
    { moduleId: "__proto__" },
    { actorId: "x' OR 1=1" },
    { subjectId: [] },
    { operationId: "x" },
    { eventName: "account.password" },
    { action: "toString" },
    { from: "yesterday" },
    { from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" },
    { source: sources[0], subjectType: "team" },
    { source: sources[1], moduleId: "service-operations" },
    { source: sources[1], eventName: "account.created" },
    { eventName: "team.created", action: "DELETED" },
    { cursor: "tampered" },
  ]) {
    assert.throws(
      () => parseManagementQuery(bad, "identity", now),
      /Invalid management history query/,
    )
  }
  const defaults = parseManagementQuery({}, "identity", now)
  assert.equal(defaults.filters.pageSize, 50)
  assert.equal(
    Date.parse(defaults.filters.to) - Date.parse(defaults.filters.from),
    7 * 86400000,
  )
})

test(
  "internal read adapters: offline persistence, pagination, failures, bounds and performance",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startPgliteApp(t, {
      migrate: async (database) => {
        await applyMigrations(database)
        await database.exec("SET TIME ZONE 'UTC'")
      },
    })
    const user = await prisma.user.create({
      data: {
        id: "root",
        email: "root@example.test",
        passwordHash: "not-used",
        role: "SUPERADMIN",
      },
    })
    await prisma.session.create({
      data: {
        id: "reader-session",
        tokenHash: "test-hash",
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000),
        lastActiveAt: at,
      },
    })
    const auth: AuthContext = { user, sessionId: "reader-session" }
    const list = (q: Record<string, unknown> = {}) =>
      listManagementHistory(auth, { ...range, ...q })
    await t.test("empty results and no route exposure", async () => {
      const page = await list()
      assert.deepEqual(page.events, [])
      assert.equal(page.complete, true)
      assert.equal(page.nextCursor, null)
      assert.equal((await fetch(`${base}/system-logs`)).status, 404)
    })
    // Fixture writes only: histories intentionally have no FK to deleted actors/subjects.
    await prisma.accountManagementChange.createMany({
      data: [account("z"), account("shared"), account("a")].map((r) => ({
        ...r,
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        actorRoleAtTime: "ADMIN",
      })),
    })
    await prisma.workforceManagementChange.createMany({
      data: [workforce("z"), workforce("shared"), workforce("a")].map((r) => ({
        ...r,
        action: "PROFILE_UPDATED",
        origin: "TEAM_MANAGEMENT",
        subjectType: "TEAM",
        actorRoleAtTime: "ADMIN",
      })),
    })
    await t.test(
      "global equal-time ordering, cursors, page-local operation grouping and filters",
      async () => {
        const expected = sources
          .slice(0, 2)
          .flatMap((source) =>
            ["z", "shared", "a"].map((id) => `${source}:${id}`),
          )
        const found: string[] = []
        let cursor: string | null = null
        do {
          const page = await list({
            pageSize: 2,
            ...(cursor ? { cursor } : {}),
          })
          assert.equal(page.grouping.eventCount, page.events.length)
          assert.equal(page.grouping.operationCount, 1)
          assert.equal(page.grouping.scope, "page")
          assert.deepEqual(
            page.grouping.operations[0].eventIds,
            page.events.map((e) => e.eventId),
          )
          found.push(...page.events.map((e) => e.eventId))
          cursor = page.nextCursor
        } while (cursor)
        assert.deepEqual(found, expected)
        assert.equal(new Set(found).size, 6)
        assert.equal(
          (await list({ from: at.toISOString(), to: at.toISOString() })).events
            .length,
          6,
        )
        assert.equal(
          (await list({ to: new Date(at.getTime() - 1).toISOString() })).events
            .length,
          0,
        )
        for (const [filter, count] of [
          [{ source: sources[0] }, 3],
          [{ moduleId: "people-hr" }, 3],
          [{ moduleId: "administration" }, 3],
          [{ actorId: "deleted-actor" }, 6],
          [{ subjectType: "team" }, 3],
          [{ subjectId: "deleted-team" }, 3],
          [{ operationId: operation }, 6],
          [{ eventName: "team.profile_updated" }, 3],
          [{ action: "PROFILE_UPDATED" }, 6],
          [{ subjectId: "absent" }, 0],
        ] as const)
          assert.equal((await list(filter)).events.length, count)
        const first = await list({ pageSize: 2 })
        await assert.rejects(
          list({ pageSize: 3, cursor: first.nextCursor }),
          /Invalid management history query/,
        )
        await assert.rejects(
          list({ pageSize: 2, cursor: `${first.nextCursor}x` }),
          /Invalid management history query/,
        )
        const detail = await getManagementHistoryEvent(
          auth,
          sources[0],
          "shared",
          range,
        )
        assert.equal(detail.event?.eventId, `${sources[0]}:shared`)
        assert.equal(
          (await getManagementHistoryEvent(auth, sources[0], "absent", range))
            .event,
          null,
        )
      },
    )
    await t.test(
      "current authorization, expiry, actor binding and no session bookkeeping writes",
      async () => {
        const first = await list({ pageSize: 2 })
        await prisma.session.create({
          data: {
            id: "second-reader",
            tokenHash: "second-hash",
            userId: user.id,
            expiresAt: new Date(Date.now() + 86400000),
          },
        })
        await assert.rejects(
          listManagementHistory(
            { ...auth, sessionId: "second-reader" },
            { ...range, pageSize: 2, cursor: first.nextCursor },
          ),
          /Invalid management history query/,
        )
        const query = parseManagementQuery(
          { ...range, pageSize: 2 },
          `${auth.user.id}:${auth.sessionId}`,
          new Date(),
        )
        const expired = encodeCursor({
          version: 1,
          fingerprint: query.fingerprint,
          snapshot: query.snapshot,
          from: query.filters.from,
          to: query.filters.to,
          after: { time: at.toISOString(), source: sources[0], id: "z" },
          expires: Date.now() - 1,
        })
        await assert.rejects(
          list({ pageSize: 2, cursor: expired }),
          /Invalid management history query/,
        )
        await prisma.session.update({
          where: { id: auth.sessionId },
          data: { expiresAt: new Date(Date.now() - 1) },
        })
        await assert.rejects(list(), /Invalid or expired session/)
        await prisma.session.update({
          where: { id: auth.sessionId },
          data: { expiresAt: new Date(Date.now() + 86400000) },
        })
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        })
        await assert.rejects(list(), /Insufficient permissions/)
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "SUPERADMIN", isActive: false },
        })
        await assert.rejects(list(), /Invalid or expired session/)
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: true, accountDeletedAt: new Date() },
        })
        await assert.rejects(list(), /Invalid or expired session/)
        await prisma.user.update({
          where: { id: user.id },
          data: { accountDeletedAt: null },
        })
        await assert.rejects(
          listManagementHistory({ ...auth, sessionId: "revoked" }, range),
          /Invalid or expired session/,
        )
        assert.equal(
          (
            await prisma.session.findUniqueOrThrow({
              where: { id: auth.sessionId },
            })
          ).lastActiveAt?.toISOString(),
          at.toISOString(),
        )
      },
    )
    await t.test(
      "malformed rows omitted without leaking payload; unavailable source is explicit",
      async () => {
        await prisma.accountManagementChange.create({
          data: {
            ...account("zz-invalid"),
            createdAt: new Date(at.getTime() - 2000),
            action: "PROFILE_UPDATED",
            origin: "ACCOUNT_MANAGEMENT",
            actorRoleAtTime: "ADMIN",
            changes: { email: "private-sentinel" },
          },
        })
        const malformedRange = {
          ...range,
          from: new Date(at.getTime() - 3000).toISOString(),
        }
        const page = await list(malformedRange)
        assert.equal(page.complete, false)
        assert.equal(page.sources[0].omittedCount, 1)
        assert.equal(page.sources[0].reasonCode, "INVALID_RECORD")
        assert.ok(!JSON.stringify(page).includes("private-sentinel"))
        await db.exec(
          'ALTER TABLE "WorkforceManagementChange" RENAME TO "UnavailableWorkforce"',
        )
        try {
          const partial = await list({ ...malformedRange, pageSize: 2 })
          assert.equal(partial.sources[1].status, "unavailable")
          assert.equal(partial.complete, false)
          assert.equal(partial.nextCursor, null)
          assert.equal(
            (await getManagementHistoryEvent(auth, sources[1], "shared", range))
              .status,
            "unavailable",
          )
        } finally {
          await db.exec(
            'ALTER TABLE "UnavailableWorkforce" RENAME TO "WorkforceManagementChange"',
          )
        }
      },
    )
    await t.test(
      "scan cap continuation does not pass an unread source",
      async () => {
        await prisma.accountManagementChange.createMany({
          data: Array.from({ length: SCAN_CAP + 2 }, (_, i) => ({
            ...account(`invalid-${String(i).padStart(4, "0")}`),
            createdAt: new Date(at.getTime() + 2000),
            action: "PROFILE_UPDATED",
            origin: "ACCOUNT_MANAGEMENT",
            actorRoleAtTime: "ADMIN",
            changes: { password: "secret-sentinel" },
          })),
        })
        const scanRange = {
          ...range,
          to: new Date(at.getTime() + 3000).toISOString(),
        }
        const page = await list(scanRange)
        assert.equal(page.events.length, 0)
        assert.equal(page.sources[0].omittedCount, SCAN_CAP)
        assert.equal(page.sources[0].reasonCode, "SCAN_CAP")
        assert.ok(page.nextCursor)
        const next = await list({ ...scanRange, cursor: page.nextCursor })
        assert.equal(next.events.length, 6)
        assert.ok(!JSON.stringify(next).includes("secret-sentinel"))
      },
    )
    await t.test(
      "mixed-case IDs use byte ordering and cursor bounds match database ordering",
      async () => {
        await prisma.accountManagementChange.createMany({
          data: ["A", "Z", "_"].map((id) => ({
            ...account(id),
            action: "PROFILE_UPDATED",
            origin: "ACCOUNT_MANAGEMENT",
            actorRoleAtTime: "ADMIN",
          })),
        })
        let cursor: string | null = null
        const ids: string[] = []
        do {
          const page = await list({
            source: sources[0],
            pageSize: 1,
            ...(cursor ? { cursor } : {}),
          })
          ids.push(...page.events.map((e) => e.sourceEventId))
          cursor = page.nextCursor
        } while (cursor)
        assert.deepEqual(ids, ["z", "shared", "a", "_", "Z", "A"])
        // Keep append-only fixtures; this runs after the six-event pagination cases.
      },
    )
    await t.test(
      "representative two-table query timings and read-only enforcement",
      async () => {
        // 20k rows over 20 days: repeated timestamps, actors, subjects and operations.
        await db.exec(`INSERT INTO "AccountManagementChange" (id,"actorAccountId","actorRoleAtTime","operationId","subjectAccountId",action,origin,"changedFields",changes,"createdAt")
      SELECT 'perf-a-'||lpad(i::text,6,'0'), 'actor-'||(i%20), 'ADMIN', '${operation}', 'subject-'||(i%100), 'PROFILE_UPDATED', 'ACCOUNT_MANAGEMENT', ARRAY['fullName'], '{}', '${at.toISOString()}'::timestamptz - ((i%20)||' days')::interval FROM generate_series(1,10000) i;
      INSERT INTO "WorkforceManagementChange" (id,"actorAccountId","actorRoleAtTime","operationId","subjectType","subjectId",action,origin,"changedFields",changes,"createdAt")
      SELECT 'perf-w-'||lpad(i::text,6,'0'), 'actor-'||(i%20), 'ADMIN', '${operation}', 'TEAM', 'team-'||(i%100), 'PROFILE_UPDATED', 'TEAM_MANAGEMENT', ARRAY['description'], '{}', '${at.toISOString()}'::timestamptz - ((i%20)||' days')::interval FROM generate_series(1,10000) i; ANALYZE "AccountManagementChange"; ANALYZE "WorkforceManagementChange";`)
        // Any table mutation by these readers now fails, including silent session touches.
        await db.exec(`CREATE FUNCTION reject_reader_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'reader wrote data'; END $$;
      DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP EXECUTE format('CREATE TRIGGER reader_no_write BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION reject_reader_write()',r.tablename); END LOOP; END $$;`)
        const timings: Record<string, number[]> = {}
        const perfRange = {
          from: new Date(at.getTime() - 20 * 86400000).toISOString(),
          to: range.to,
        }
        for (const [name, filter] of [
          ["global", {}],
          ["actor", { actorId: "actor-0" }],
          ["subject", { subjectId: "subject-0" }],
          ["operation", { operationId: operation }],
        ] as const) {
          timings[name] = []
          for (let i = 0; i < 5; i++) {
            const started = performance.now()
            const page = await listManagementHistory(auth, {
              ...perfRange,
              ...filter,
            })
            timings[name].push(
              Math.round((performance.now() - started) * 100) / 100,
            )
            assert.equal(
              page.events.length,
              50,
              JSON.stringify({ name, sources: page.sources }),
            )
            assert.equal(
              page.sources.every((s) => s.status === "available"),
              true,
            )
            assert.equal(page.complete, true)
            assert.ok(page.nextCursor)
          }
        }
        // Generous smoke budget, not a production SLA; raw timings are reported for review.
        assert.ok(
          Object.values(timings)
            .flat()
            .every((ms) => ms < 5000),
        )
        t.diagnostic(
          `Append-only fixture: ${(await prisma.accountManagementChange.count()) + (await prisma.workforceManagementChange.count())} history rows; 5 runs/query, milliseconds: ${JSON.stringify(timings)}`,
        )
        const before = await prisma.accountManagementChange.count()
        const page = await listManagementHistory(auth, { ...perfRange })
        await listManagementHistory(auth, {
          ...perfRange,
          cursor: page.nextCursor,
        })
        await getManagementHistoryEvent(auth, sources[0], "shared", range)
        assert.equal(await prisma.accountManagementChange.count(), before)
        const plan = await db.query(
          `EXPLAIN (ANALYZE, BUFFERS) SELECT id,"createdAt" FROM "AccountManagementChange" WHERE "createdAt" >= '${perfRange.from}' AND "createdAt" <= '${perfRange.to}' ORDER BY "createdAt" DESC,id COLLATE "C" DESC LIMIT 501`,
        )
        t.diagnostic(
          `Account global ordering plan: ${JSON.stringify(plan.rows)}`,
        )
      },
    )
  },
)
