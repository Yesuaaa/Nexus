import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { normalizeProjectAudit } from "../../../src/features/system-logs/project-audit.adapter.js"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { setMilestoneCompletion } from "../../../src/features/projects/projects.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import type { NormalizedEventV1 } from "../../../src/features/system-logs/management-event.js"

test("Project projection rejects service/internal/ambiguous types and never infers role or operation", () => {
  const row = {
    id: "historic-event",
    type: "PROJECT_MILESTONE_UPDATED",
    entityId: "historic-project",
    actorId: "historic-actor",
    createdAt: new Date(),
    internal: false,
  }
  const event = normalizeProjectAudit(row)!
  assert.equal(event.subject.type, "project")
  assert.equal(event.subject.id, row.entityId)
  assert.equal(event.actor.roleAtTime, null)
  assert.equal(event.correlation.operationId, null)
  assert.equal(
    normalizeProjectAudit({ ...row, actorId: null })!.actor.kind,
    "unknown",
  )
  for (const patch of [
    { type: "CONSULTATION_OPENED" },
    { type: "PROJECT_ACTIVATED" },
    { type: "WORKSPACE_RENAMED" },
    { type: "PROJECT_DELIVERABLE_SENT_TO_CLIENT" },
    { internal: true },
    { entityId: null },
    { summary: "confidential" },
  ])
    assert.equal(normalizeProjectAudit({ ...row, ...patch }), null)
})

test(
  "project source uses existing writers, paginates safely and excludes service/internal/confidential events",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startSystemLogsApp(t)
    const tokens = new Map<Role, string>()
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `project-reader-${role}`,
          role,
          email: `${role}@project-audit.test`,
          fullName: "private-project-sentinel",
          passwordHash: "private-secret",
        },
      })
      tokens.set(role, (await issueSession(user)).token)
    }
    const department = await prisma.department.create({
      data: { name: "Private department", headId: "project-reader-STAFF" },
    })
    const service = await prisma.service.create({
      data: {
        name: "Private service",
        description: "private-project-sentinel",
      },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        clientId: "project-reader-USER",
        serviceId: service.id,
        acceptedDepartmentId: department.id,
        title: "private-project-sentinel",
        workflow: { create: { state: "ACTIVE_PROJECT" } },
      },
    })
    const project = await prisma.project.create({
      data: {
        id: "recorded-project",
        requestId: request.id,
        clientId: "project-reader-USER",
        name: "private-project-sentinel",
        status: "IN_PROGRESS",
      },
    })
    const milestone = await prisma.projectMilestone.create({
      data: { projectId: project.id, title: "private-project-sentinel" },
    })
    await setMilestoneCompletion(
      "project-reader-STAFF",
      project.id,
      milestone.id,
      true,
    )
    const written = await prisma.workflowEvent.findFirstOrThrow({
      where: { type: "PROJECT_MILESTONE_UPDATED" },
    })
    assert.equal(written.entityId, project.id)
    assert.equal(written.actorId, "project-reader-STAFF")
    const at = new Date(Date.now() - 3600000)
    for (const type of [
      "STAFFING_ALLOCATED",
      "CONSULTATION_OPENED",
      "PROJECT_ACTIVATED",
      "PROJECT_CANCELLATION_REQUESTED",
      "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
      "WORKSPACE_RENAMED",
      "WORKSPACE_TASK_UPDATED",
      "UNREVIEWED_TYPE",
    ]) {
      await prisma.workflowEvent.create({
        data: {
          requestId: request.id,
          type,
          actorId: null,
          entityId: "historical-project-no-longer-present",
          summary: "private-project-sentinel",
          internal: false,
          createdAt: at,
        },
      })
    }
    await prisma.workflowEvent.create({
      data: {
        requestId: request.id,
        type: "STAFFING_ALLOCATED",
        entityId: project.id,
        summary: "private-project-sentinel",
        internal: true,
        createdAt: at,
      },
    })
    await prisma.workflowEvent.create({
      data: {
        requestId: request.id,
        type: "STAFFING_ALLOCATED",
        entityId: null,
        summary: "private-project-sentinel",
        internal: false,
        createdAt: at,
      },
    })
    // A current role change must not rewrite historical role-at-time.
    await prisma.user.update({
      where: { id: "project-reader-STAFF" },
      data: { role: Role.USER },
    })
    const digest = JSON.stringify(
      await prisma.workflowEvent.findMany({ orderBy: { id: "asc" } }),
    )
    await prisma.accountManagementChange.create({
      data: {
        id: "project-cross-source",
        actorAccountId: "project-reader-SUPERADMIN",
        actorRoleAtTime: Role.SUPERADMIN,
        operationId: randomUUID(),
        subjectAccountId: "historical-account",
        action: "PROFILE_UPDATED",
        origin: "ACCOUNT_MANAGEMENT",
        changedFields: ["fullName"],
        changes: {},
        createdAt: at,
      },
    })
    type Page = {
      events: NormalizedEventV1[]
      nextCursor: string | null
      complete: boolean
      sources: { source: string; status: string }[]
      grouping: { operationCount: number; ungroupedEventCount: number }
    }
    async function read(
      query = "moduleId=project-management",
      role: Role | null = Role.SUPERADMIN,
      path = "/management-history",
    ) {
      const response = await fetch(`${base}${path}?${query}`, {
        headers: role ? { Authorization: `Bearer ${tokens.get(role)}` } : {},
      })
      assert.equal(response.headers.get("cache-control"), "no-store")
      const text = await response.text()
      assert.ok(
        !/private-project-sentinel|"summary"|passwordHash|"requestId"|fileName|weeklyHours/.test(
          text,
        ),
      )
      return { response, page: JSON.parse(text) as Page }
    }
    const first = await read("moduleId=project-management&pageSize=1")
    assert.equal(first.response.status, 200)
    assert.equal(first.page.events[0].sourceEventId, written.id)
    assert.equal(first.page.events[0].actor.accountId, "project-reader-STAFF")
    assert.equal(first.page.events[0].actor.roleAtTime, null)
    assert.equal(first.page.grouping.operationCount, 0)
    assert.equal(first.page.grouping.ungroupedEventCount, 1)
    const second = await read(
      `moduleId=project-management&pageSize=1&cursor=${encodeURIComponent(first.page.nextCursor!)}`,
    )
    assert.equal(second.page.events.length, 1)
    assert.equal(
      second.page.events[0].subject.id,
      "historical-project-no-longer-present",
    )
    assert.equal(second.page.events[0].actor.kind, "unknown")
    assert.equal(second.page.nextCursor, null)
    assert.equal(
      (
        await read(
          `source=audit.workflow&actorId=project-reader-STAFF&subjectType=project&subjectId=${project.id}&eventName=project.project_milestone_updated`,
        )
      ).page.events.length,
      1,
    )
    assert.equal(
      (await read("moduleId=service-operations")).page.events.length,
      0,
    )
    const mixed: string[] = []
    let cursor: string | null = null
    do {
      const current: Page = (
        await read(
          `pageSize=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        )
      ).page
      mixed.push(...current.events.map((event) => event.eventId))
      cursor = current.nextCursor
    } while (cursor)
    const all = (await read("pageSize=100")).page
    assert.deepEqual(
      mixed,
      all.events.map((event) => event.eventId),
    )
    assert.equal(all.events.length, 3)
    assert.equal(all.grouping.operationCount, 1)
    assert.equal(all.grouping.ungroupedEventCount, 2)
    assert.equal(
      all.events[1].eventId,
      "audit.account-management:project-cross-source",
    )
    for (const invalid of [
      "source=audit.workflow&moduleId=attendance-monitoring",
      "source=audit.workflow&operationId=" + randomUUID(),
      "source=audit.workflow&action=PROJECT_ACTIVATED",
      "source=audit.workflow&subjectType=account",
      "source=audit.workflow&eventName=project.workspace_renamed",
    ])
      assert.equal((await read(invalid)).response.status, 400)
    assert.equal(
      (
        await read(
          "",
          Role.SUPERADMIN,
          `/management-history/events/audit.workflow/${written.id}`,
        )
      ).response.status,
      200,
    )
    for (const role of [null, Role.ADMIN, Role.STAFF, Role.USER])
      assert.equal(
        (await read("moduleId=project-management", role)).response.status,
        role === null ? 401 : 403,
      )
    await db.exec(
      'ALTER TABLE "WorkflowEvent" RENAME TO "ProjectAuditUnavailable"',
    )
    try {
      assert.equal((await read()).response.status, 503)
      const partial = await read("")
      assert.equal(partial.page.complete, false)
      assert.equal(partial.page.nextCursor, null)
    } finally {
      await db.exec(
        'ALTER TABLE "ProjectAuditUnavailable" RENAME TO "WorkflowEvent"',
      )
    }
    assert.equal(
      JSON.stringify(
        await prisma.workflowEvent.findMany({ orderBy: { id: "asc" } }),
      ),
      digest,
    )
    await prisma.user.update({
      where: { id: "project-reader-SUPERADMIN" },
      data: { role: Role.ADMIN },
    })
    assert.equal((await read()).response.status, 403)
  },
)
