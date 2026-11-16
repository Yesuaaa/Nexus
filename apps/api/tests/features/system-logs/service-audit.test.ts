import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID, createHash } from "node:crypto"
import {
  parseManagementQuery,
  encodeCursor,
} from "../../../src/features/system-logs/management-query.js"
import { normalizeWorkflowAudit } from "../../../src/features/system-logs/workflow-audit.adapter.js"
import {
  serviceActions,
  workflowTypes,
} from "../../../src/features/system-logs/service-audit.catalog.js"
import { startSystemLogsApp } from "../../support/system-logs-app.js"
import { issueSession } from "../../../src/features/auth/auth.service.js"
import { actOnWorkflow } from "../../../src/features/request-workflow/workflow.service.js"
import { Role } from "../../../src/generated/prisma/client.js"
import type { NormalizedEventV1 } from "../../../src/features/system-logs/management-event.js"

test("shared workflow classifier pairs subject/module/type and preserves only recorded identities", () => {
  const row = {
    id: "audit-row",
    requestId: "historical-request",
    type: "QUOTATION_SENT",
    actorId: "historical-actor",
    entityId: "not-a-project-id",
    internal: false,
    createdAt: new Date(),
  }
  const event = normalizeWorkflowAudit(row)!
  assert.equal(event.moduleId, "service-operations")
  assert.equal(event.subject.type, "service_request")
  assert.equal(event.subject.id, row.requestId)
  assert.equal(event.actor.accountId, row.actorId)
  assert.equal(event.actor.roleAtTime, null)
  assert.equal(event.correlation.operationId, null)
  assert.equal(
    normalizeWorkflowAudit({ ...row, actorId: null, entityId: null })!.actor
      .kind,
    "unknown",
  )
  const project = normalizeWorkflowAudit({
    ...row,
    type: "STAFFING_ALLOCATED",
  })!
  assert.equal(project.subject.id, row.entityId)
  assert.equal(project.moduleId, "project-management")
  for (const change of [
    { internal: true },
    { requestId: null },
    { type: "PAYMENT_VERIFIED" },
    { type: "QUOTATION_INTERNAL_APPROVED" },
    { type: "CONSULTATION_OPENED" },
    { type: "PROJECT_ACTIVATED" },
    { summary: "private" },
    { type: "UNKNOWN" },
  ])
    assert.equal(normalizeWorkflowAudit({ ...row, ...change }), null)
  assert.deepEqual(
    workflowTypes({
      moduleId: "service-operations",
      action: "STAFFING_ALLOCATED",
    }),
    [],
  )
  assert.deepEqual(
    workflowTypes({
      moduleId: "project-management",
      eventName: "service_request.quotation_sent",
    }),
    [],
  )
})

test(
  "Service Operations audit preserves client history and isolates shared-source classification, paging and privacy",
  { timeout: 180000 },
  async (t) => {
    const { prisma, db, base } = await startSystemLogsApp(t)
    const tokens = new Map<Role, string>()
    for (const role of Object.values(Role)) {
      const user = await prisma.user.create({
        data: {
          id: `service-reader-${role}`,
          email: `${role}@service-audit.test`,
          role,
          fullName: "private-service-sentinel",
          passwordHash: "private-secret",
        },
      })
      tokens.set(role, (await issueSession(user)).token)
    }
    const headId = "service-reader-STAFF"
    const department = await prisma.department.create({
      data: { name: "Service audit", headId },
    })
    const service = await prisma.service.create({
      data: { name: "Service audit", description: "private-service-sentinel" },
    })
    const request = await prisma.serviceRequest.create({
      data: {
        id: "service-history-request",
        clientId: "service-reader-USER",
        serviceId: service.id,
        title: "private-service-sentinel",
        acceptedDepartmentId: department.id,
        workflow: { create: { state: "CONSULTATION" } },
      },
    })
    // Real unchanged workflow writer; no new audit emitter.
    await actOnWorkflow(headId, request.id, {
      type: "CANCEL",
      actionId: randomUUID(),
      expectedVersion: 1,
      note: "private-service-sentinel",
    })
    const real = await prisma.workflowEvent.findFirstOrThrow({
      where: { type: "WORKFLOW_CANCELLED" },
    })
    assert.equal(real.actorId, headId)
    const at = new Date(Date.now() - 3600000)
    for (const type of serviceActions.filter(
      (type) => type !== "WORKFLOW_CANCELLED",
    ))
      await prisma.workflowEvent.create({
        data: {
          id: `service-${type}`,
          requestId: request.id,
          type,
          entityId: "private-source-entity",
          actorId: null,
          internal: false,
          summary: "private-service-sentinel confidential amount file message",
          createdAt: at,
        },
      })
    for (const type of [
      "CONSULTATION_OPENED",
      "QUOTATION_INTERNAL_REVIEW",
      "QUOTATION_INTERNAL_APPROVED",
      "PAYMENT_VERIFIED",
      "REQUIREMENT_SUBMITTED",
      "INTERNAL_NOTE",
      "PROJECT_ACTIVATED",
      "PROJECT_DELIVERABLE_SENT_TO_CLIENT",
    ])
      await prisma.workflowEvent.create({
        data: {
          requestId: request.id,
          type,
          summary: "private-service-sentinel",
          entityId: "private-source-entity",
          internal: false,
          createdAt: at,
        },
      })
    await prisma.workflowEvent.create({
      data: {
        id: "internal-service",
        requestId: request.id,
        type: "QUOTATION_SENT",
        summary: "private-service-sentinel",
        internal: true,
        createdAt: at,
      },
    })
    await prisma.workflowEvent.create({
      data: {
        id: "recorded-project",
        requestId: request.id,
        type: "PROJECT_MILESTONE_UPDATED",
        entityId: "historical-project",
        actorId: headId,
        summary: "private-service-sentinel",
        createdAt: at,
      },
    })
    await prisma.accountManagementChange.create({
      data: {
        id: "retained-client-account",
        actorAccountId: headId,
        actorRoleAtTime: Role.STAFF,
        operationId: randomUUID(),
        subjectAccountId: "historic-client",
        action: "PROFILE_UPDATED",
        origin: "CLIENT_MANAGEMENT",
        changedFields: ["fullName"],
        changes: {},
        createdAt: at,
      },
    })
    const digest = JSON.stringify(
      await prisma.workflowEvent.findMany({ orderBy: { id: "asc" } }),
    )
    type Page = {
      events: NormalizedEventV1[]
      nextCursor: string | null
      complete: boolean
      sources: { source: string; status: string }[]
      grouping: { operationCount: number; ungroupedEventCount: number }
    }
    async function read(
      query = "moduleId=service-operations",
      role: Role | null = Role.SUPERADMIN,
      path = "/management-history",
    ) {
      const response = await fetch(`${base}${path}?${query}`, {
        headers: role ? { Authorization: `Bearer ${tokens.get(role)}` } : {},
      })
      assert.equal(response.headers.get("cache-control"), "no-store")
      const text = await response.text()
      assert.ok(
        !/private-service-sentinel|private-secret|private-source-entity|"summary"|"requestId"|amount|fileName|passwordHash/.test(
          text,
        ),
      )
      return { response, page: JSON.parse(text) as Page }
    }
    const all = (await read()).page
    assert.equal(all.events.length, 7)
    assert.equal(all.grouping.operationCount, 1)
    assert.equal(all.grouping.ungroupedEventCount, 6)
    assert.ok(
      all.events.every((event) => event.moduleId === "service-operations"),
    )
    assert.equal(all.events[0].sourceEventId, real.id)
    const workflow = (await read("source=audit.workflow")).page
    assert.equal(workflow.events.length, 7)
    assert.equal(new Set(workflow.events.map((event) => event.eventId)).size, 7)
    const projects = (await read("moduleId=project-management")).page
    assert.deepEqual(
      projects.events.map((event) => event.sourceEventId),
      ["recorded-project"],
    )
    const filtered = (
      await read(
        `source=audit.workflow&moduleId=service-operations&subjectType=service_request&subjectId=${request.id}&action=QUOTATION_SENT&eventName=service_request.quotation_sent`,
      )
    ).page
    assert.equal(filtered.events.length, 1)
    assert.equal(filtered.events[0].subject.id, request.id)
    const ids: string[] = []
    let cursor: string | null = null
    do {
      const current: Page = (
        await read(
          `moduleId=service-operations&pageSize=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        )
      ).page
      ids.push(...current.events.map((event) => event.eventId))
      cursor = current.nextCursor
    } while (cursor)
    assert.deepEqual(
      ids,
      all.events.map((event) => event.eventId),
    )
    const first = (await read("moduleId=service-operations&pageSize=2")).page
    const legacy: Parameters<typeof encodeCursor>[0] = JSON.parse(
      Buffer.from(first.nextCursor!.split(".")[0], "base64url").toString(
        "utf8",
      ),
    )
    const rootSession = await prisma.session.findFirstOrThrow({
      where: { userId: "service-reader-SUPERADMIN" },
    })
    const identity = `service-reader-SUPERADMIN:${rootSession.id}`
    const parsedQuery = parseManagementQuery(
      {
        moduleId: "service-operations",
        pageSize: 2,
        from: legacy.from,
        to: legacy.to,
      },
      identity,
      new Date(),
    )
    legacy.fingerprint = createHash("sha256")
      .update(JSON.stringify([identity, parsedQuery.filters]))
      .digest("hex")
    assert.equal(
      (
        await read(
          `moduleId=service-operations&pageSize=2&cursor=${encodeURIComponent(encodeCursor(legacy))}`,
        )
      ).response.status,
      400,
    )
    assert.equal(
      (
        await read(
          `moduleId=project-management&pageSize=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
        )
      ).response.status,
      400,
    )
    const detail = await read(
      "",
      Role.SUPERADMIN,
      `/management-history/events/audit.workflow/${real.id}`,
    )
    assert.equal(detail.response.status, 200)
    for (const bad of [
      "source=audit.workflow&moduleId=project-management&action=QUOTATION_SENT",
      "source=audit.workflow&moduleId=service-operations&subjectType=project",
      "source=audit.workflow&operationId=" + randomUUID(),
    ])
      assert.equal((await read(bad)).response.status, 400)
    for (const role of [null, Role.ADMIN, Role.STAFF, Role.USER])
      assert.equal(
        (await read("moduleId=service-operations", role)).response.status,
        role === null ? 401 : 403,
      )
    await prisma.user.update({
      where: { id: headId },
      data: { role: Role.USER },
    })
    const historical = (
      await read(`source=audit.workflow&actorId=${headId}`)
    ).page.events.find((event) => event.sourceEventId === real.id)!
    assert.equal(historical.actor.roleAtTime, null)
    assert.equal(historical.correlation.operationId, null)
    await db.exec(
      'ALTER TABLE "WorkflowEvent" RENAME TO "ServiceAuditUnavailable"',
    )
    try {
      const partial = await read()
      assert.equal(partial.response.status, 200)
      assert.equal(partial.page.complete, false)
      assert.equal(partial.page.nextCursor, null)
      assert.equal(partial.page.events.length, 1)
      assert.equal(
        (await read("source=audit.workflow&moduleId=service-operations"))
          .response.status,
        503,
      )
    } finally {
      await db.exec(
        'ALTER TABLE "ServiceAuditUnavailable" RENAME TO "WorkflowEvent"',
      )
    }
    assert.equal(
      JSON.stringify(
        await prisma.workflowEvent.findMany({ orderBy: { id: "asc" } }),
      ),
      digest,
    )
    const root = "service-reader-SUPERADMIN"
    await prisma.user.update({ where: { id: root }, data: { isActive: false } })
    assert.equal((await read()).response.status, 401)
    await prisma.user.update({
      where: { id: root },
      data: { isActive: true, role: Role.ADMIN },
    })
    assert.equal((await read()).response.status, 403)
  },
)
