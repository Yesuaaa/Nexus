import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { normalizeAttendanceAudit } from "../../../src/features/system-logs/attendance-audit.adapter.js"
import {
  attendanceSource,
  attendanceSubjects,
  attendanceActions,
  attendanceActionSupported,
} from "../../../src/features/system-logs/attendance-audit.catalog.js"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import type { NormalizedEventV1 } from "../../../src/features/system-logs/management-event.js"

test("Attendance audit projection is closed, metadata-only and never manufactures historical attribution", () => {
  const row = {
    id: "audit-row",
    entityType: "AttendancePolicyDay",
    entityId: "policy:1",
    actorId: "historical-actor",
    action: "UPDATE",
    createdAt: new Date(),
  }
  const event = normalizeAttendanceAudit(row)!
  assert.equal(event.actor.accountId, "historical-actor")
  assert.equal(event.actor.roleAtTime, null)
  assert.equal(event.correlation.operationId, null)
  assert.equal(event.subject.id, "policy:1")
  assert.deepEqual(event.details.transitions, {})
  assert.equal(
    normalizeAttendanceAudit({ ...row, actorId: null })!.actor.kind,
    "unknown",
  )
  for (const invalid of [
    { ...row, before: { name: "private" } },
    { ...row, reason: "private" },
    { ...row, actionId: randomUUID() },
    { ...row, entityType: "AttendancePrivate" },
    { ...row, action: "APPROVED" },
    { ...row, entityType: "AttendanceWorkday", action: "DELETE" },
    { ...row, actorId: "private@example.test" },
  ])
    assert.equal(normalizeAttendanceAudit(invalid), null)
})

test(
  "real Attendance history integrates with source/module paging, details, privacy, outages and current Superadmin auth",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startSystemLogsApp(t)
    const tokens = new Map<Role, string>()
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `attendance-reader-${role}`,
          email: `${role}@audit.test`,
          fullName: "private-attendance-sentinel",
          passwordHash: "private-secret",
          role,
        },
      })
      tokens.set(role, (await issueSession(user)).token)
    }
    const historical = await prisma.user.create({
      data: {
        id: "attendance-historical",
        email: "historical@audit.test",
        fullName: "private-attendance-sentinel",
        passwordHash: "unused",
        role: Role.ADMIN,
      },
    })
    const at = new Date(Date.now() - 3600000)
    let sequence = 0
    for (const entityType of Object.keys(attendanceSubjects))
      for (const action of attendanceActions) {
        if (!attendanceActionSupported(entityType, action)) continue
        await prisma.attendanceAudit.create({
          data: {
            id: `attendance-${String(sequence++).padStart(3, "0")}`,
            entityType,
            entityId:
              entityType === "AttendancePolicyDay"
                ? "policy:1"
                : "historical-resource",
            actorId: historical.id,
            action,
            reason: "private-attendance-sentinel",
            before: {
              workDate: "private-attendance-sentinel",
              reason: "private-attendance-sentinel",
            },
            after: {
              fullName: "private-attendance-sentinel",
              proposedStartedAt: "private-attendance-sentinel",
            },
            actionId: randomUUID(),
            createdAt: at,
          },
        })
      }
    // Exercise the unchanged database trigger, not a new audit writer.
    const policy = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.attendance_actor_id', ${historical.id}, true)`
      return tx.attendancePolicy.create({
        data: { name: "private-attendance-sentinel", timeZone: "Asia/Manila" },
      })
    })
    const triggerAudit = await prisma.attendanceAudit.findFirstOrThrow({
      where: { entityId: policy.id },
    })
    assert.equal(triggerAudit.actorId, historical.id)
    await prisma.user.update({
      where: { id: historical.id },
      data: { role: Role.USER },
    })
    const operation = randomUUID()
    await prisma.accountManagementChange.create({
      data: {
        id: "cross-source",
        actorAccountId: historical.id,
        actorRoleAtTime: Role.ADMIN,
        operationId: operation,
        subjectAccountId: "historic-account",
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["fullName"],
        changes: {},
        createdAt: at,
      },
    })
    const digest = JSON.stringify(
      await prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } }),
    )
    type Page = {
      events: NormalizedEventV1[]
      nextCursor: string | null
      complete: boolean
      sources: { source: string; status: string }[]
      grouping: { operationCount: number; ungroupedEventCount: number }
    }
    async function request(
      query: string,
      role: Role | null = Role.SUPERADMIN,
      path = "/management-history",
    ) {
      const response = await fetch(`${base}${path}?${query}`, {
        headers: role ? { Authorization: `Bearer ${tokens.get(role)}` } : {},
      })
      assert.equal(response.headers.get("cache-control"), "no-store")
      const text = await response.text()
      assert.ok(
        !/private-attendance-sentinel|private-secret|proposedStartedAt|"reason"|"before"|"after"|workDate/.test(
          text,
        ),
      )
      return { response, page: JSON.parse(text) as Page }
    }
    const ids: string[] = []
    let cursor: string | null = null
    do {
      const result = await request(
        `moduleId=attendance-monitoring&pageSize=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      )
      assert.equal(result.response.status, 200)
      assert.equal(result.page.grouping.operationCount, 0)
      assert.equal(
        result.page.grouping.ungroupedEventCount,
        result.page.events.length,
      )
      for (const event of result.page.events) {
        assert.equal(event.actor.roleAtTime, null)
        assert.equal(event.actor.accountId, historical.id)
        assert.equal(event.correlation.operationId, null)
      }
      ids.push(...result.page.events.map((event) => event.eventId))
      cursor = result.page.nextCursor
    } while (cursor)
    assert.equal(ids.length, 21)
    assert.equal(new Set(ids).size, 21)
    const first = (await request(`source=${attendanceSource}&pageSize=1`)).page
    assert.equal(
      (await request(`source=${attendanceSource}&operationId=${operation}`))
        .response.status,
      400,
    )
    assert.equal(
      (
        await request(
          `source=audit.account-management&cursor=${encodeURIComponent(first.nextCursor!)}`,
        )
      ).response.status,
      400,
    )
    const selected = (
      await request(
        `source=${attendanceSource}&subjectType=attendance_policy_day&subjectId=policy%3A1&action=UPDATE&actorId=${historical.id}`,
      )
    ).page
    assert.equal(selected.events.length, 1)
    const detail = await request(
      "",
      Role.SUPERADMIN,
      `/management-history/events/${attendanceSource}/${triggerAudit.id}`,
    )
    assert.equal(detail.response.status, 200)
    const mixed = (await request("pageSize=100")).page
    assert.equal(mixed.events.length, 22)
    assert.equal(mixed.grouping.operationCount, 1)
    assert.equal(mixed.grouping.ungroupedEventCount, 21)
    assert.equal(mixed.events[0].sourceEventId, triggerAudit.id)
    assert.equal(
      mixed.events[1].eventId,
      "audit.account-management:cross-source",
    )
    const pagedMixed: string[] = []
    let mixedCursor: string | null = null
    do {
      const current: Page = (
        await request(
          `pageSize=2${mixedCursor ? `&cursor=${encodeURIComponent(mixedCursor)}` : ""}`,
        )
      ).page
      pagedMixed.push(...current.events.map((event) => event.eventId))
      mixedCursor = current.nextCursor
    } while (mixedCursor)
    assert.deepEqual(
      pagedMixed,
      mixed.events.map((event) => event.eventId),
    )
    for (const role of [null, Role.ADMIN, Role.STAFF, Role.USER])
      assert.equal(
        (await request(`source=${attendanceSource}`, role)).response.status,
        role === null ? 401 : 403,
      )
    await db.exec(
      'ALTER TABLE "AttendanceAudit" RENAME TO "AttendanceAuditUnavailable"',
    )
    try {
      const failed = await request(`source=${attendanceSource}`)
      assert.equal(failed.response.status, 503)
      const partial = await request("")
      assert.equal(partial.response.status, 200)
      assert.equal(partial.page.complete, false)
      assert.equal(partial.page.nextCursor, null)
    } finally {
      await db.exec(
        'ALTER TABLE "AttendanceAuditUnavailable" RENAME TO "AttendanceAudit"',
      )
    }
    assert.equal(
      JSON.stringify(
        await prisma.attendanceAudit.findMany({ orderBy: { id: "asc" } }),
      ),
      digest,
    )
    await prisma.user.update({
      where: { id: "attendance-reader-SUPERADMIN" },
      data: { role: Role.ADMIN },
    })
    assert.equal(
      (await request(`source=${attendanceSource}`)).response.status,
      403,
    )
  },
)
